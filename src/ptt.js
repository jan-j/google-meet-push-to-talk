import { io } from "socket.io-client";

import { getSavedValues, addChangeListener } from "./js/storage";
import { elementReady } from "./js/element-ready";
import log from "./js/log";

const MIC_OFF = {
  de: "Mikrofon deaktivieren",
  en: "Turn off microphone",
  ja: "マイクをオフにする",
};

const MIC_ON = {
  de: "Mikrofon aktivieren",
  en: "Turn on microphone",
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
    elementReady(offButtonSelector()).then((button) => {
      clickUntilMuted();
    });
  }
});

addChangeListener(({ hotkey }) => {
  hookUpListeners(hotkey);
});

function getMuteStatus() {
  var button = offButton() || onButton();
  var value = button ? button.getAttribute("data-is-muted") : null;
  if ("true" === value) {
    return "chromeMute:muted";
  } else if ("false" === value) {
    return "chromeMute:unmuted";
  } else {
    return "chromeMute:disabled";
  }
}

const toggleMuteStatus = () => {
  (offButton() || onButton())?.click();
};

var port = chrome.runtime.connect({ name: "meet" });
port.onMessage.addListener(function (msg) {
  if (msg?.toggle === "mute") {
    toggleMuteStatus();
  }
});

var socket = io("http://localhost:8249");

socket.on("getMuteStatus", function (data) {
  socket.emit("muteStatus", { data: getMuteStatus(), id: data.id });
});

socket.on("toggleMuteStatus", function (data) {
  toggleMuteStatus();
  socket.emit("muteStatusToggled", { data: "done", id: data.id });
});
