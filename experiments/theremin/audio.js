const KEY_NOTES = {
  r: 82,
  g: 71,
  b: 66
};

const KEY_PITCH = {
  up: 38,
  down: 40
};

class ImageProcessor {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
  }
  data(video, w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.context.clearRect(0, 0, w, h);
    this.context.drawImage(video, 0, 0, w, h);
    return this.context.getImageData(0, 0, w, h);
  }
}

class Composer {
  constructor(iProcessor, vibration) {
    this.iProcessor = iProcessor;
    this.vibration = vibration;
    this.note = KEY_NOTES.r;
    this.pitch = 10;
  }
  setNote(note) {
    this.note = note;
  }
  setPitch(pitchDirection) {
    if (KEY_PITCH.up === pitchDirection) {
      this.pitch += 1;
    } else {
      if (this.pitch > 1) {
        this.pitch -= 1;
      }
    }
  }
  run() {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.vibration.start(100);

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { width: window.innerWidth, height: window.innerHeight }
      })
      .then(stream => {
        video.style = "display:none";
        video.srcObject = stream;
      })
      .catch(console.error);

    document.body.appendChild(canvas);

    const capture = () => {
      const image = this.iProcessor.data(
        video,
        window.innerWidth,
        window.innerHeight
      );

      let rTotal = 0;
      let gTotal = 0;
      let bTotal = 0;

      const len = image.data.length;

      for (let i = 0; i < len; i += 4) {
        rTotal += image.data[i];
        gTotal += image.data[i + 1];
        bTotal += image.data[i + 2];
      }

      switch (this.note) {
        case KEY_NOTES.r:
          this.vibration.hz((rTotal / len) * this.pitch);
          break;
        case KEY_NOTES.g:
          this.vibration.hz((gTotal / len) * this.pitch);
          break;
        case KEY_NOTES.b:
          this.vibration.hz((bTotal / len) * this.pitch);
          break;
      }

      context.putImageData(image, 0, 0);
      window.requestAnimationFrame(capture);
    };

    capture();
  }
}

class VibrationController {
  constructor(context) {
    this.context = context;
    this.oscillator = context.createOscillator();
    this.gainNode = context.createGain();
  }
  start(hz) {
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = hz;
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);
    this.oscillator.start();
  }
  gain(val) {
    this.gainNode.gain.exponentialRampToValueAtTime(
      val,
      this.context.currentTime + 0.04
    );
  }
  hz(hz) {
    if (hz && !isNaN(hz)) {
      this.oscillator.frequency.value = hz;
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("go");
  btn.addEventListener("click", function() {
    btn.style.display = "none";

    const composer = new Composer(
      new ImageProcessor(),
      new VibrationController(new AudioContext())
    );

    composer.run();

    document.addEventListener("keydown", function(event) {
      if (Object.values(KEY_NOTES).indexOf(event.keyCode) !== -1) {
        composer.setNote(event.keyCode);
      }
      if (Object.values(KEY_PITCH).indexOf(event.keyCode) !== -1) {
        composer.setPitch(event.keyCode);
      }
    });
  });
});
