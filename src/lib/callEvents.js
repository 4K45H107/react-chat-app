/** Window event the chat header uses to ask the call overlay to start a call. */
export const START_CALL_EVENT = "rca:start-call";

export const requestStartCall = ({ type, partner, activeChatId }) => {
  window.dispatchEvent(
    new CustomEvent(START_CALL_EVENT, {
      detail: { type, partner, activeChatId },
    })
  );
};
