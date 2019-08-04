const keyMap = {
  left: 37,
  right: 39,
  up: 38,
  down: 40,
  r: 82,
  g: 71,
  b: 66,
  u: 85
};

const KEY_NOTES = {
  r: keyMap.r,
  g: keyMap.g,
  b: keyMap.b
};

const KEY_PITCH = {
  up: keyMap.up,
  down: keyMap.down
};

const KEY_GAIN = {
  up: keyMap.right,
  down: keyMap.left
};

const KEY_RECORDER = {
  undo: keyMap.u
};

class AudioTrack {
  constructor(audio) {
    this.audio = audio;
  }
  loopEndlessly() {
    this.audio.addEventListener("ended", () => {
      this.audio.currentTime = 0;
      this.audio.play();
    });
    this.audio.play();
    return this;
  }
  kill() {
    this.audio.pause();
  }
}

class Recorder {
  constructor() {
    this.tracks = [];
    this._currentRecordData = [];
    this.recording = false;
    this.mediaRecorder = null;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.addEventListener("dataavailable", event => {
        this._currentRecordData.push(event.data);
      });

      this.mediaRecorder.addEventListener("stop", () => {
        if (this._currentRecordData.length && this._currentRecordData[0].size) {
          const audioBlob = new Blob(this._currentRecordData);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          this.tracks.push(new AudioTrack(audio).loopEndlessly());
        }
        this._currentRecordData = [];
      });
    });
  }
  record() {
    setTimeout(() => {
      this.mediaRecorder.start();
    }, 300);
    this.recording = true;
  }
  save() {
    this.mediaRecorder.stop();
    this.recording = false;
  }
  silence() {
    this.tracks.forEach(track => track.audio.pause());
  }
  unsilence() {
    this.tracks.forEach(track => track.audio.play());
  }
  removeLast() {
    if (this.tracks.length) {
      this.tracks[this.tracks.length - 1].kill();
      this.tracks.pop();
    }
  }
}

class ImageProcessor {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.context = this.canvas.getContext("2d");
    this.context.globalCompositeOperation = "difference";
  }
  data(video, w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    // this.context.clearRect(0, 0, w, h);
    this.context.drawImage(video, 0, 0, w, h);
    return this.context.getImageData(0, 0, w, h);
  }
}

class Vibration {
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
    if (!this._silenced) {
      this.gainNode.gain.exponentialRampToValueAtTime(
        val,
        this.context.currentTime + 0.01
      );
    }
  }
  hz(hz) {
    if (hz && !isNaN(hz)) {
      this.oscillator.frequency.value = hz;
    }
  }
  silence() {
    // this._prevGain = this.gainNode.gain.value;
    this._silenced = true;
    this.gainNode.gain.exponentialRampToValueAtTime(
      0.0000001,
      this.context.currentTime + 0.01
    );
  }
  unsilence() {
    this._silenced = false;
  }
}

class RecordIndicator {
  show() {
    this.el = document.createElement("div");
    this.el.className = "record-indicator";
    document.body.appendChild(this.el);
  }
  hide() {
    if (this.el) {
      document.body.removeChild(this.el);
      this.el = null;
    }
  }
}

class Composer {
  constructor(
    iProcessor,
    vibration,
    recorder,
    recordIndicator,
    videoEl,
    canvasEl
  ) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.iProcessor = iProcessor;
    this.vibration = vibration;
    this.recorder = recorder;
    this.recordIndicator = recordIndicator;
    this.note = KEY_NOTES.r;
    this.pitch = 15;
    this.gain = 1;
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
  setGain(gainDirection) {
    if (KEY_GAIN.up === gainDirection) {
      if (this.gain < 1) {
        this.gain += 0.1;
      }
    } else {
      if (this.pitch > 0) {
        this.gain -= 0.1;
      }
    }
  }
  toggleRecordMode() {
    if (this.recorder.recording) {
      this.vibration.unsilence();
      this.recorder.unsilence();
      this.recorder.save();
      this.recordIndicator.hide();
    } else {
      this.vibration.silence();
      this.recorder.silence();
      this.recorder.record();
      this.recordIndicator.show();
    }
  }
  removeLastTrack() {
    this.recorder.removeLast();
  }
  run() {
    const context = this.canvasEl.getContext("2d");
    this.vibration.start(100);

    this.canvasEl.width = window.innerWidth;
    this.canvasEl.height = window.innerHeight;
    context.globalCompositeOperation = "difference";

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { width: window.innerWidth, height: window.innerHeight }
      })
      .then(stream => {
        this.videoEl.style = "display:none";
        this.videoEl.srcObject = stream;
      })
      .catch(console.error);

    const capture = () => {
      const image = this.iProcessor.data(
        this.videoEl,
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

        if (this.note === KEY_NOTES.r) {
          image.data[i + 1] = 0;
          image.data[i + 2] = 0;
        } else if (this.note === KEY_NOTES.g) {
          image.data[i] = 0;
          image.data[i + 2] = 0;
        } else {
          image.data[i] = 0;
          image.data[i + 1] = 0;
        }
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

      this.vibration.gain(this.gain);

      context.putImageData(image, 0, 0);
      setTimeout(() => capture(), 185);
    };

    capture();
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const btn = document.getElementById("go");
  btn.addEventListener(
    "click",
    function() {
      btn.style.display = "none";

      const recorder = new Recorder();

      const composer = new Composer(
        new ImageProcessor(),
        new Vibration(new AudioContext()),
        recorder,
        new RecordIndicator(),
        document.getElementById("video"),
        document.getElementById("canvas")
      );

      composer.run();

      setTimeout(() => {
        document.addEventListener(
          "click",
          function() {
            composer.toggleRecordMode();
          },
          false
        );
      }, 100);

      document.addEventListener(
        "keydown",
        function(event) {
          if (Object.values(KEY_GAIN).indexOf(event.keyCode) !== -1) {
            composer.setGain(event.keyCode);
          }

          if (Object.values(KEY_NOTES).indexOf(event.keyCode) !== -1) {
            composer.setNote(event.keyCode);
          }

          if (Object.values(KEY_PITCH).indexOf(event.keyCode) !== -1) {
            composer.setPitch(event.keyCode);
          }

          if (event.keyCode === KEY_RECORDER.undo) {
            composer.removeLastTrack();
          }
        },
        false
      );
    },
    false
  );
});
