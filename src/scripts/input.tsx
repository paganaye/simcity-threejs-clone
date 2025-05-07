
/** 
 * Manages mouse and keyboard input
 */
export class InputManager {
  /**
   * Last mouse position
   */
  mouse = { x: 0, y: 0 };
  /**
   * True if left mouse button is currently down
   */
  isLeftMouseDown = false;
  /**
   * True if the middle mouse button is currently down
   */
  isMiddleMouseDown = false;
  /**
   * True if the right mouse button is currently down
   */
  isRightMouseDown = false;

  constructor(gameWindow: HTMLDivElement) {
    gameWindow.addEventListener('mousedown', this.#onMouseDown.bind(this), false);
    gameWindow.addEventListener('mouseup', this.#onMouseUp.bind(this), false);
    gameWindow.addEventListener('mousemove', this.#onMouseMove.bind(this), false);
    gameWindow.addEventListener('contextmenu', (event) => event.preventDefault(), false);
  }

  /**
   * Event handler for `mousedown` event
   */
  #onMouseDown(event: MouseEvent) {
    if (event.button === 0) {
      this.isLeftMouseDown = true;
    }
    if (event.button === 1) {
      this.isMiddleMouseDown = true;
    }
    if (event.button === 2) {
      this.isRightMouseDown = true;
    }
  }

  /**
   * Event handler for `mouseup` event
   */
  #onMouseUp(event: MouseEvent) {
    if (event.button === 0) {
      this.isLeftMouseDown = false;
    }
    if (event.button === 1) {
      this.isMiddleMouseDown = false;
    }
    if (event.button === 2) {
      this.isRightMouseDown = false;
    }
  }

  /**
   * Event handler for 'mousemove' event
   * @param {MouseEvent} event 
   */
  #onMouseMove(event: MouseEvent) {
    this.isLeftMouseDown = (event.buttons & 1) != 0;
    this.isRightMouseDown = (event.buttons & 2) != 0;
    this.isMiddleMouseDown = (event.buttons & 4) != 0;
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
  }
}