import { bindDrivingContact } from './driving-contact.js';

// The visible control is an actual hit area, not a decoration over the canvas.
// Pressing either side steers immediately; one captured thumb can then drag.
export function bindSteeringPad(element, steering, {enabled = () => true, onChange = () => {}, ...options} = {}) {
  return bindDrivingContact(element, {
    ...options, enabled,
    onStart(contact) {
      const box = element.getBoundingClientRect();
      const range = Math.max(20, (box.width - 48) / 2);
      if (!steering.start(contact.pointerId, box.left + box.width / 2, box.width, range)) return false;
      steering.move(contact.pointerId, contact.clientX);
      onChange();
    },
    onMove(contact) { steering.move(contact.pointerId, contact.clientX); onChange(); },
    onEnd(contact) { steering.release(contact.pointerId); onChange(); },
  });
}

export function bindDragSteering(element, steering, {enabled = () => true, width = () => element.getBoundingClientRect().width, onChange = () => {}, ...options} = {}) {
  return bindDrivingContact(element, {
    ...options, enabled,
    onStart(contact) {
      if (!steering.start(contact.pointerId, contact.clientX, width())) return false;
      onChange();
    },
    onMove(contact) { steering.move(contact.pointerId, contact.clientX); onChange(); },
    onEnd(contact) { steering.release(contact.pointerId); onChange(); },
  });
}
