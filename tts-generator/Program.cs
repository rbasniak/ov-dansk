using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.CognitiveServices.Speech;

const string VoiceName = "da-DK-ChristelNeural";

var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);
var repositoryRoot = FindRepositoryRoot(AppContext.BaseDirectory);
var projectDirectory = Path.Combine(repositoryRoot, "tts-generator");
var assetsDirectory = Path.Combine(repositoryRoot, "assets");
var words = ExtractWords(repositoryRoot);
var configuration = new ConfigurationBuilder()
    .SetBasePath(projectDirectory)
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.local.json", optional: true)
    .AddUserSecrets<Program>(optional: true)
    .AddEnvironmentVariables()
    .Build();
var requestDelayMilliseconds = GetRequestDelayMilliseconds(configuration);

Directory.CreateDirectory(assetsDirectory);

var missingWords = words
    .Where(word => !File.Exists(Path.Combine(assetsDirectory, ToAssetFileName(word))))
    .OrderBy(word => word, StringComparer.Create(new System.Globalization.CultureInfo("da-DK"), ignoreCase: true))
    .ToArray();

Console.WriteLine(
    $"Found {words.Count} unique Danish forms; {missingWords.Length} MP3 file(s) are missing. " +
    $"Delay between requests: {requestDelayMilliseconds} ms.");

if (dryRun)
{
    foreach (var word in missingWords)
    {
        Console.WriteLine($"{word} -> {Path.Combine("assets", ToAssetFileName(word))}");
    }

    return;
}

if (missingWords.Length == 0)
{
    return;
}

var subscriptionKey = GetRequiredSetting(configuration, "AzureSpeech:Key", "AZURE_SPEECH_KEY");
var region = GetRequiredSetting(configuration, "AzureSpeech:Region", "AZURE_SPEECH_REGION");
var speechConfig = SpeechConfig.FromSubscription(subscriptionKey, region);
speechConfig.SpeechSynthesisVoiceName = VoiceName;
speechConfig.SetSpeechSynthesisOutputFormat(SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3);

using var synthesizer = new SpeechSynthesizer(speechConfig, audioConfig: null);

var generated = 0;
foreach (var word in missingWords)
{
    var outputPath = Path.Combine(assetsDirectory, ToAssetFileName(word));
    using var result = await synthesizer.SpeakTextAsync(word);

    if (result.Reason != ResultReason.SynthesizingAudioCompleted)
    {
        var details = SpeechSynthesisCancellationDetails.FromResult(result);
        throw new InvalidOperationException(
            $"Azure Speech could not synthesize '{word}'. Reason: {details.Reason}. Error: {details.ErrorDetails}");
    }

    await File.WriteAllBytesAsync(outputPath, result.AudioData);
    generated++;
    Console.WriteLine($"Generated {Path.Combine("assets", ToAssetFileName(word))} ({generated}/{missingWords.Length}).");

    if (generated < missingWords.Length && requestDelayMilliseconds > 0)
    {
        await Task.Delay(requestDelayMilliseconds);
    }
}

static HashSet<string> ExtractWords(string repositoryRoot)
{
    var words = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var fields = new[] { "da", "definiteSg", "plural", "definitePl", "inf", "present", "past", "perfect", "imp" };
    var pattern = $@"(?m)\b(?:{string.Join("|", fields)})\s*:\s*'((?:\\.|[^'])*)'";

    foreach (var fileName in new[] { "nouns-data.js", "verbs-data.js" })
    {
        var path = Path.Combine(repositoryRoot, "js", fileName);
        var source = File.ReadAllText(path, Encoding.UTF8);

        foreach (Match match in Regex.Matches(source, pattern, RegexOptions.CultureInvariant))
        {
            var word = UnescapeJavaScriptString(match.Groups[1].Value).Trim();
            if (word.Length > 0 && word != "—")
            {
                words.Add(word);
            }
        }
    }

    return words;
}

static string UnescapeJavaScriptString(string value) =>
    Regex.Replace(value, @"\\(['\\])", "$1");

static string ToAssetFileName(string word)
{
    var builder = new StringBuilder(word.Length + 4);
    foreach (var character in word)
    {
        if (character == '%' || Path.GetInvalidFileNameChars().Contains(character))
        {
            foreach (var byteValue in Encoding.UTF8.GetBytes(character.ToString()))
            {
                builder.Append('%').Append(byteValue.ToString("X2"));
            }
        }
        else
        {
            builder.Append(character);
        }
    }

    return $"{builder}.mp3";
}

static string FindRepositoryRoot(string startingDirectory)
{
    for (var directory = new DirectoryInfo(startingDirectory); directory is not null; directory = directory.Parent)
    {
        if (File.Exists(Path.Combine(directory.FullName, "js", "nouns-data.js")) &&
            File.Exists(Path.Combine(directory.FullName, "js", "verbs-data.js")))
        {
            return directory.FullName;
        }
    }

    throw new DirectoryNotFoundException(
        $"Could not find the repository root from '{startingDirectory}'. Expected js\\nouns-data.js and js\\verbs-data.js.");
}

static string GetRequiredSetting(IConfiguration configuration, string configurationKey, string legacyEnvironmentVariable) =>
    Environment.GetEnvironmentVariable(legacyEnvironmentVariable) is { Length: > 0 } environmentValue
        ? environmentValue
        : configuration[configurationKey] is { Length: > 0 } configurationValue
            ? configurationValue
            : throw new InvalidOperationException(
                $"Set '{configurationKey}' in User Secrets or appsettings.local.json, or set '{legacyEnvironmentVariable}'.");

static int GetRequestDelayMilliseconds(IConfiguration configuration)
{
    const int defaultDelayMilliseconds = 3100;
    var configuredValue = Environment.GetEnvironmentVariable("AZURE_SPEECH_REQUEST_DELAY_MILLISECONDS")
        ?? configuration["AzureSpeech:RequestDelayMilliseconds"];

    if (string.IsNullOrWhiteSpace(configuredValue))
    {
        return defaultDelayMilliseconds;
    }

    return int.TryParse(configuredValue, out var delayMilliseconds) && delayMilliseconds >= 0
        ? delayMilliseconds
        : throw new InvalidOperationException(
            "'AzureSpeech:RequestDelayMilliseconds' must be a non-negative integer.");
}
