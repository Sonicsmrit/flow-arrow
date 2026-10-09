import { getSession, updateSession } from "./sw/session.js";
import {
  startSession,
  stopSession,
  runTurn,
  recordOutcome,
  handleHello,
  handleReady,
} from "./sw/loop.js";
import { toggleVoice, forgetTab } from "./sw/voice.js";

function log(...args) {
  console.log("[FlowArrow:sw]", ...args);
}

function logFailure(what) {
  return (err) => console.error(`[FlowArrow:sw] ${what} failed`, err);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (tabId == null) return false;

  switch (message.type) {
    case "FLOW_START": {
      sendResponse({ ok: true });
      startSession(tabId, message.goal, message.lang, message.speak).catch((err) => {
        logFailure("startSession")(err);
        chrome.tabs.sendMessage(tabId, {
          type: "FLOW_ERROR",
          message: "Something went wrong starting Flow Arrow.",
          retryable: false,
        });
      });
      return false;
    }

    case "FLOW_HELLO": {
      handleHello(tabId)
        .then(({ summary, resume }) => {
          sendResponse({ session: summary });
          if (summary) log(`hello from tab ${tabId} (${summary.status}, t${summary.turn})`);
          return resume();
        })
        .catch((err) => {
          logFailure("FLOW_HELLO")(err);
          sendResponse({ session: null });
        });
      return true; // async response
    }

    case "FLOW_STEP_RESULT": {
      sendResponse({ ok: true });
      recordOutcome(tabId, message.turn, message.outcome).catch(logFailure("FLOW_STEP_RESULT"));
      return false;
    }

    case "FLOW_READY": {
      sendResponse({ ok: true });
      handleReady(tabId, message.turn).catch(logFailure("FLOW_READY"));
      return false;
    }

    case "FLOW_STOP": {
      sendResponse({ ok: true });
      stopSession(tabId).catch(logFailure("FLOW_STOP"));
      return false;
    }

    case "FLOW_RETRY": {
      sendResponse({ ok: true });
      getSession(tabId)
        .then((s) => (s ? runTurn(tabId) : null))
        .catch(logFailure("FLOW_RETRY"));
      return false;
    }

    case "FLOW_VOICE_TOGGLE": {
      sendResponse({ ok: true });
      toggleVoice(tabId).catch(logFailure("FLOW_VOICE_TOGGLE"));
      return false;
    }

    case "FLOW_SPEAK_TOGGLE": {
      sendResponse({ ok: true });
      updateSession(tabId, (s) => {
        s.speak = !!message.speak;
      }).catch(logFailure("FLOW_SPEAK_TOGGLE"));
      return false;
    }

    default:
      log("not implemented yet:", message.type);
      return false;
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-voice") return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    chrome.tabs.sendMessage(activeTab.id, { type: "FLOW_TOGGLE_VOICE" }, () => void chrome.runtime.lastError);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => forgetTab(tabId));

// First install: the welcome tab asks for the microphone once.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: "welcome/welcome.html" });
});

log("service worker started");
