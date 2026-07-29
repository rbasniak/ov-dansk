'use strict';

const REVIEW_MATCH_FADE_MS = 2000;
const REVIEW_MATCH_SLOT_COUNT = 5;

function uniqueReviewMatchItems(items) {
  const danish = new Set();
  const english = new Set();
  return items.filter(item => {
    const da = item.danish.toLocaleLowerCase('da-DK');
    const en = item.english.toLocaleLowerCase('en-US');
    if (danish.has(da) || english.has(en)) return false;
    danish.add(da);
    english.add(en);
    return true;
  });
}

class ReviewMatchQueue {
  constructor(items) {
    this.items = [...items];
    this.pendingItem = null;
    this.reservedItem = null;
  }

  takeInitial() {
    return this.items.shift() || null;
  }

  replacement() {
    const left = this.reservedItem || this.items.shift() || null;
    if (!left) return { left: null, right: null };

    if (this.reservedItem) this.reservedItem = null;

    if (this.pendingItem) {
      const right = this.pendingItem;
      this.pendingItem = null;
      return { left, right };
    }

    const next = this.items.shift() || null;
    if (!next) return { left, right: left };

    this.pendingItem = left;
    this.reservedItem = next;
    return { left, right: next };
  }

  get isEmpty() {
    return this.items.length === 0 && !this.pendingItem && !this.reservedItem;
  }
}

class ReviewMatchGame {
  constructor({ container, items, onDanishSelected, onResult, onComplete, onProgress }) {
    this.container = container;
    this.queue = new ReviewMatchQueue(items);
    this.onDanishSelected = onDanishSelected;
    this.onResult = onResult;
    this.onComplete = onComplete;
    this.onProgress = onProgress;
    this.left = Array(REVIEW_MATCH_SLOT_COUNT).fill(null);
    this.right = Array(REVIEW_MATCH_SLOT_COUNT).fill(null);
    this.selectedLeft = null;
    this.selectedRight = null;
    this.correct = 0;
    this.attempts = 0;
    this.totalItems = items.length;

    const initial = [];
    for (let index = 0; index < REVIEW_MATCH_SLOT_COUNT; index++) {
      const item = this.queue.takeInitial();
      if (!item) break;
      this.left[index] = item;
      initial.push(item);
    }
    const shuffledAnswers = [...initial].sort(() => Math.random() - 0.5);
    shuffledAnswers.forEach((item, index) => { this.right[index] = item; });

    this._render();
  }

  _render() {
    this.container.innerHTML = `
      <div class="review-match-status" id="review-match-status"></div>
      <div class="review-match-columns">
        <div class="review-match-column">
          <div class="review-match-heading">Danish</div>
          <div class="review-match-slots" id="review-match-left"></div>
        </div>
        <div class="review-match-column">
          <div class="review-match-heading">English</div>
          <div class="review-match-slots" id="review-match-right"></div>
        </div>
      </div>`;

    this.leftContainer = this.container.querySelector('#review-match-left');
    this.rightContainer = this.container.querySelector('#review-match-right');
    this.left.forEach((item, index) => this._renderSlot('left', index, item, true));
    this.right.forEach((item, index) => this._renderSlot('right', index, item, true));
    this._updateProgress();
  }

  _renderSlot(side, index, item, fadeIn = false) {
    const container = side === 'left' ? this.leftContainer : this.rightContainer;
    let slot = container.children[index];
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'review-match-slot';
      container.appendChild(slot);
    }
    slot.innerHTML = '';
    if (!item) return;

    const button = document.createElement('button');
    button.className = `review-match-btn${fadeIn ? ' review-match-entering' : ''}`;
    button.textContent = side === 'left' ? item.danish : item.english;
    button.addEventListener('click', () => this._select(side, index, button));
    slot.appendChild(button);
  }

  _select(side, index, button) {
    const otherSide = side === 'left' ? 'right' : 'left';
    const previous = side === 'left' ? this.selectedLeft : this.selectedRight;
    previous?.button.classList.remove('selected');

    const selection = { index, button, item: side === 'left' ? this.left[index] : this.right[index] };
    if (side === 'left') {
      this.selectedLeft = selection;
      this.onDanishSelected?.(selection.item.danish);
    } else {
      this.selectedRight = selection;
    }
    button.classList.add('selected');

    const other = otherSide === 'left' ? this.selectedLeft : this.selectedRight;
    if (other) this._evaluate();
  }

  _evaluate() {
    const left = this.selectedLeft;
    const right = this.selectedRight;
    const correct = left.item.id === right.item.id;
    this.attempts++;
    if (correct) this.correct++;
    this.onResult?.({ correct, leftItem: left.item, rightItem: right.item });
    this._updateProgress();

    const className = correct ? 'review-match-correct' : 'review-match-wrong';
    left.button.classList.add(className);
    right.button.classList.add(className);
    left.button.disabled = true;
    right.button.disabled = true;
    this.selectedLeft = null;
    this.selectedRight = null;

    if (!correct) {
      window.setTimeout(() => {
        left.button.classList.remove('selected', className);
        right.button.classList.remove('selected', className);
        left.button.disabled = false;
        right.button.disabled = false;
      }, 500);
      return;
    }

    const replacement = this.queue.replacement();
    left.button.classList.add('review-match-leaving');
    right.button.classList.add('review-match-leaving');
    window.setTimeout(() => {
      this.left[left.index] = null;
      this.right[right.index] = null;
      this.left[left.index] = replacement.left;
      this.right[right.index] = replacement.right;
      this._renderSlot('left', left.index, replacement.left, true);
      this._renderSlot('right', right.index, replacement.right, true);
      this._updateProgress();

      if (this.queue.isEmpty && this.left.every(item => item === null)) {
        this.onComplete?.({ correct: this.correct, attempts: this.attempts });
      }
    }, REVIEW_MATCH_FADE_MS);
  }

  _updateProgress() {
    const status = this.container.querySelector('#review-match-status');
    status.textContent = `${this.correct} correct / ${this.totalItems} words`;
    this.onProgress?.({ correct: this.correct, attempts: this.attempts, total: this.totalItems });
  }
}
