
// /** 
//  * Manages mouse and keyboard input
//  */
// export class InputManager {

//   x: number = 0;
//   y: number = 0;
//   buttons: number = 0;


//   constructor(gameWindow: HTMLElement) {
//     gameWindow.addEventListener('mousedown', this.#onMouseEvent.bind(this), false);
//     gameWindow.addEventListener('mouseup', this.#onMouseEvent.bind(this), false);
//     gameWindow.addEventListener('mousemove', this.#onMouseEvent.bind(this), false);
//     gameWindow.addEventListener('contextmenu', (event) => event.preventDefault(), false);
//   }


//   #onMouseEvent(event: MouseEvent) {
//     this.x = event.clientX;
//     this.y = event.clientY;
//     this.buttons = event.buttons;
//   }

//   get isLeftMouseDown() { return (this.buttons & 1) != 0; }
//   get isRightMouseDown() { return (this.buttons & 2) != 0; }
//   get isMiddleMouseDown() { return (this.buttons & 4) != 0; }

// }