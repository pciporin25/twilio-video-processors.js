'use strict';

const Video = Twilio.Video;
const { GaussianBlurBackgroundProcessor, VirtualBackgroundProcessor, isSupported } = Twilio.VideoProcessors;
const bootstrap = window.bootstrap;

const gaussianBlurForm = document.querySelector('form#gaussianBlur-Form');
const gaussianBlurButton = document.querySelector('button#gaussianBlur-Apply');
const virtualBackgroundForm = document.querySelector('form#virtualBackground-Form');
const virtualBackgroundButton = document.querySelector('button#virtualBackground-Apply');
const removeProcessorButton = document.querySelector('button#no-processor-apply');
const toggleAudioMuteButton = document.querySelector('button#toggle-audio-mute');
const errorMessage = document.querySelector('div.modal-body');
const errorModal = new bootstrap.Modal(document.querySelector('div#errorModal'));

const urlSearchParams = new URLSearchParams(window.location.search);
const token = Object.fromEntries(urlSearchParams.entries()).token;
console.log('token is', token)

const room = await Video.connect(token, {
  name: 'my-cool-room',
  audio: true
});

const addTrack = (id, track) => {
  let el = document.getElementById(`video-input-${id}`);
  console.log('attaching track', track, 'to element', el)
  track.attach(el);
}

const createVideoElementAndAddTrack = (id, track) => {
  // we are only interested in video tracks
  if (track.kind === 'audio') return;

  console.log('creating videoElement with id', id, 'for track', track)
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.id = `video-input-${id}`;
  // not an ideal solution, but onload seems to be firing early
  videoElement.onload = setTimeout(() => addTrack(id, track), 500);
  document.getElementById("container").appendChild(videoElement);
}

const handleRemoteParticipant = (participant) => {
  participant.tracks.forEach(publication => {
    if (publication.isSubscribed) {
      const track = publication.track;
      console.log('PUBLICATION IS SUBSCRIBED', track)
      createVideoElementAndAddTrack(track.sid, track)
    }
  });

  participant.on('trackSubscribed', track => {
    console.log('TRACK SUBSCRIBED', track);
    createVideoElementAndAddTrack(track.sid, track)
  });
}

// handle participants already in room
room.participants.forEach(participant => {
  handleRemoteParticipant(participant);
})

// handle participants joining room
room.on('participantConnected', participant => {
  console.log(`A remote Participant connected`, participant.videoTracks);
  handleRemoteParticipant(participant);  
});

// how many local video tracks to render
const NUM_VIDEO_TRACKS = 1;
const videoTracks = [];

const createAndAttachTracks = (i) => {
  Video.createLocalVideoTrack({
    width: 1280,
    height: 720,
    frameRate: 24,
  }).then((track) => {
    let el = document.getElementById(`video-input${i}`);
    track.attach(el);

    videoTracks.push(track);
    room.localParticipant.publishTrack(track);
  });
}

for (var i=1; i<=NUM_VIDEO_TRACKS; i++) {
  // create html element
  const videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.id = `video-input${i}`;
  videoElement.onload = createAndAttachTracks(i);
  document.getElementById("container").appendChild(videoElement);
}

// Same directory as the current js file
const assetsPath = '';

let videoTrack1;
let videoTrack2;
let videoTrack3;
let gaussianBlurProcessor;
let virtualBackgroundProcessor;

if(!isSupported){
  errorMessage.textContent = 'This browser is not supported.';
  errorModal.show();
}

const loadImage = (name) =>
  new Promise((resolve) => {
    const image = new Image();
    image.src = `backgrounds/${name}.jpg`;
    image.onload = () => resolve(image);
  });

let images = {};
Promise.all([
  loadImage('living_room'),
  loadImage('office'),
  loadImage('vacation'),
]).then(([livingRoom, office, vacation]) => {
  images.livingRoom = livingRoom;
  images.office = office;
  images.vacation = vacation;
  return images;
});

// Adding processor to Video Track
const setProcessor = (processor, track) => {
  if (track.processor) {
    removeProcessorButton.disabled = true;
    track.removeProcessor(track.processor);
  }
  if (processor) {
    removeProcessorButton.disabled = false;
    console.log('here and processor is',processor, 'track is', track);
    track.addProcessor(processor);
  }
};

gaussianBlurButton.onclick = async event => {
  event.preventDefault();
  const options = {};
  const inputs = gaussianBlurForm.getElementsByTagName('input');
  for (let item of inputs) {
    options[item.id] = item.valueAsNumber;
  }
  const { maskBlurRadius, blurFilterRadius } = options;
  if (!gaussianBlurProcessor) {
    gaussianBlurProcessor = new GaussianBlurBackgroundProcessor({
      assetsPath,
      maskBlurRadius,
      blurFilterRadius,
    });
    await gaussianBlurProcessor.loadModel();
  } else {
    gaussianBlurProcessor.maskBlurRadius = maskBlurRadius;
    gaussianBlurProcessor.blurFilterRadius = blurFilterRadius;
  }

  for (const videoTrack in videoTracks) {
    setProcessor(gaussianBlurProcessor, videoTracks[videoTrack]);
  }
};

virtualBackgroundButton.onclick = async event => {
  event.preventDefault();
  const options = {};
  const inputs = virtualBackgroundForm.elements;
  for (let item of inputs) {
    item.valueAsNumber
      ? (options[item.id] = item.valueAsNumber)
      : (options[item.id] = item.value);
  }
  let backgroundImage = images[options.backgroundImage];
  let { maskBlurRadius, fitType } = options;
  if (!virtualBackgroundProcessor) {
    virtualBackgroundProcessor = new VirtualBackgroundProcessor({
      assetsPath,
      maskBlurRadius,
      backgroundImage,
      fitType,
    });
    await virtualBackgroundProcessor.loadModel();
  } else {
    virtualBackgroundProcessor.backgroundImage = backgroundImage;
    virtualBackgroundProcessor.fitType = fitType;
    virtualBackgroundProcessor.maskBlurRadius = maskBlurRadius;
  }

  for (const videoTrack in videoTracks) {
    console.log('applying virtual background to', videoTracks[videoTrack]);
    console.log('videoTracks is', videoTracks);
    setProcessor(virtualBackgroundProcessor, videoTracks[videoTrack]);
  }
};

removeProcessorButton.disabled = true;
removeProcessorButton.onclick = event => {
  event.preventDefault();

  for (const videoTrack in videoTracks) {
    setProcessor(null, videoTracks[videoTrack]);
  }
};

toggleAudioMuteButton.onclick = event => {
  event.preventDefault();

  console.log('localParticipant', room.localParticipant);
  room.localParticipant.audioTracks.forEach(({ track }) => {
    if (track.isEnabled) {
      track.disable();
    } else {
      track.enable();
    }
  });
  console.log('localParticipant', room.localParticipant);
}