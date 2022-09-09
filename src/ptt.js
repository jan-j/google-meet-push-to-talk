import { getSavedValues, addChangeListener } from "./js/storage";
import { elementReady } from "./js/element-ready";

const MIC_OFF = {
  de: "Mikrofon deaktivieren",
  en: "Turn off microphone",
  pl: "Wyłącz mikrofon",
  ja: "マイクをオフにする",
};

const MIC_ON = {
  de: "Mikrofon aktivieren",
  en: "Turn on microphone",
  pl: "Włącz mikrofon",
  ja: "マイクをオンにする",
};

let currentHotkey, keydownToggle, keyupToggle;

const currentLanguage = () => document.documentElement.lang;
const oldMicButtonSelector = (tip) => `[data-tooltip*='${tip}']`;
const micButtonSelector = (tip) => `[aria-label*='${tip}']`;

const offButtonSelector = () =>
  [
    "[data-is-muted=false][aria-label*='+ d']",
    "[data-is-muted=false][aria-label*='+ D']",
    "[data-is-muted=false][data-tooltip*='+ d']",
    "[data-is-muted=false][data-tooltip*='+ D']",
    micButtonSelector(MIC_OFF[currentLanguage()]),
    oldMicButtonSelector(MIC_OFF[currentLanguage()]),
  ].join(",");
const offButton = () => document.querySelector(offButtonSelector());

const onButtonSelector = () =>
  [
    "[data-is-muted=true][aria-label*='+ d']",
    "[data-is-muted=true][aria-label*='+ D']",
    "[data-is-muted=true][data-tooltip*='+ d']",
    "[data-is-muted=true][data-tooltip*='+ D']",
    micButtonSelector(MIC_ON[currentLanguage()]),
    oldMicButtonSelector(MIC_ON[currentLanguage()]),
  ].join(",");
const onButton = () => document.querySelector(onButtonSelector());

const isCurrentlyMuted = () => onButton() !== null;

let keydownCount = 0;
let muteButtonStateBeforeKeypress = null;

const toggle = (hotkey, isMuted) => {
  // actual event listener
  return (event) => {
    if (event.target && ["input", "textarea"].includes(event.target.type)) {
      return;
    }

    if (event.type === "keydown" && !hotkey.matchKeydown(event)) {
      return;
    }

    if (event.type === "keyup" && !hotkey.matchKeyup(event)) {
      return;
    }

    if (event.target?.dataset?.tooltip) {
      event.stopPropagation();
    }

    event.preventDefault();

    if (event.type === "keydown") {
      keydownCount += 1;

      // deciding state of mute button before the keypress
      if (keydownCount === 1) {
        muteButtonStateBeforeKeypress = isCurrentlyMuted();
      }
    }

    if (event.type === "keyup") {
      // if keydown event is counted more than once than it's interpreted as push to talk trigger
      // otherwise just toggle the mute state
      const interpretAsPushToTalk = keydownCount > 1;

      // reset keydown counter on keyup event
      keydownCount = 0;

      if (!interpretAsPushToTalk) {
        // if mute button state is false (not muted) then we need to toggle it on manually
        if (!muteButtonStateBeforeKeypress) {
          setTimeout(() => offButton()?.click(), 100);
        }

        // if not interpreted as push to talk then keyup event should not toggle push to talk
        return;
      }
    }

    const micButton = isMuted ? onButton() : offButton();
    micButton?.click();
  };
};

const hookUpListeners = (hotkey) => {
  if (currentHotkey) {
    document.body.removeEventListener("keydown", keydownToggle);
    document.body.removeEventListener("keyup", keyupToggle);
  }
  currentHotkey = hotkey;
  keydownToggle = toggle(hotkey, true);
  keyupToggle = toggle(hotkey, false);

  document.body.addEventListener("keydown", keydownToggle);
  document.body.addEventListener("keyup", keyupToggle);
};

const clickUntilMuted = (maxAttempts = 40) => {
  if (maxAttempts === 0) {
    return;
  }

  const button = offButton();
  if (button) {
    button.click();
    setTimeout(() => clickUntilMuted(maxAttempts - 1), 250);
  }
};

getSavedValues(({ hotkey, muteOnJoin }) => {
  hookUpListeners(hotkey);

  if (muteOnJoin) {
    elementReady(offButtonSelector()).then(() => {
      clickUntilMuted();
    });
  }
});

addChangeListener(({ hotkey }) => {
  hookUpListeners(hotkey);
});

const toggleMuteStatus = () => {
  (offButton() || onButton())?.click();
};

const port = chrome.runtime.connect({ name: "meet" });
port.onMessage.addListener(function (msg) {
  if (msg?.toggle === "mute") {
    toggleMuteStatus();
  }
});
