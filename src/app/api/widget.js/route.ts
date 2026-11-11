/**
 * GET /api/widget.js — the embeddable chat widget loader.
 *
 * A website owner embeds one script tag:
 *   <script src="{APP_URL}/api/widget.js" data-workspace="{workspaceId}"></script>
 *
 * Dependency-free vanilla JS, no framework, no external requests except
 * back to the app origin that served this script. It contains NO keys
 * and NO Supabase references — it only talks to the public
 * /api/widget/* routes, which enforce the rules server-side.
 *
 * Behaviour:
 * - reads data-workspace from its own script tag,
 * - fetches the workspace's widget config,
 * - renders a launcher button + chat panel (brand colour, configured
 *   corner), asks for name/email once when the config says so and
 *   stores them in localStorage, remembers the conversation id in
 *   localStorage, polls for new agent messages every 5 seconds while
 *   the panel is open, and offers a "Talk to a human" handoff button.
 * - The panel only ever says a message was stored (what the API
 *   returned) — it never claims an agent received or read it.
 */
export const dynamic = "force-dynamic";

const WIDGET_SCRIPT = `(function () {
  "use strict";

  var POLL_MS = 5000;
  var MAX_MESSAGE_LENGTH = 5000;

  function findScriptTag() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].getAttribute("src") || "";
      if (src.indexOf("widget.js") !== -1) return scripts[i];
    }
    return scripts.length ? scripts[scripts.length - 1] : null;
  }

  var scriptTag = findScriptTag();
  if (!scriptTag) return;
  var workspaceId = scriptTag.getAttribute("data-workspace") || "";
  var src = scriptTag.getAttribute("src") || "";
  if (!workspaceId || !src) return;

  var origin = src.split("/api/widget.js")[0];
  if (!origin) return;

  var storeKey = function (suffix) {
    return "linguadesk_widget_" + workspaceId + "_" + suffix;
  };
  var load = function (suffix) {
    try { return window.localStorage.getItem(storeKey(suffix)); } catch (e) { return null; }
  };
  var save = function (suffix, value) {
    try { window.localStorage.setItem(storeKey(suffix), value); } catch (e) {}
  };

  function el(tag, style, text) {
    var node = document.createElement(tag);
    if (style) node.setAttribute("style", style);
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function api(path, options) {
    return fetch(origin + path, options).then(function (res) {
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    });
  }

  fetch(origin + "/api/widget/config?workspace=" + encodeURIComponent(workspaceId))
    .then(function (res) {
      if (!res.ok) throw new Error("No widget configured");
      return res.json();
    })
    .then(function (payload) {
      var config = payload.config || {};
      boot(config);
    })
    .catch(function () {
      /* No widget configured (or unreachable) — stay invisible. */
    });

  function boot(config) {
    var brand = config.brand_color || "#0D9488";
    var position = config.position === "bottom-left" ? "left" : "right";
    var side = position === "left" ? "left:16px;" : "right:16px;";
    var name = config.name || "Chat with us";
    var welcome = config.welcome_message || "Hi! How can we help you today?";
    var greeting = config.greeting_message || welcome;
    var collectName = config.collect_name !== false;
    var collectEmail = config.collect_email !== false;

    var conversationId = load("conversation");
    var storedName = load("name");
    var storedEmail = load("email");
    var handoffRequested = load("handoff") === "1";
    var messages = [];
    var pollTimer = null;
    var sending = false;

    var launcher = el("button",
      "position:fixed;bottom:16px;" + side + "z-index:2147483647;" +
      "width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;" +
      "background:" + brand + ";color:#fff;font-size:24px;line-height:1;" +
      "box-shadow:0 4px 16px rgba(0,0,0,0.25);font-family:inherit;",
      "\\uD83D\\uDCAC");
    launcher.setAttribute("aria-label", "Open chat");
    launcher.setAttribute("title", name);

    var panel = el("div",
      "position:fixed;bottom:84px;" + side + "z-index:2147483647;" +
      "width:320px;max-width:calc(100vw - 32px);height:440px;max-height:calc(100vh - 110px);" +
      "background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.25);" +
      "display:none;flex-direction:column;overflow:hidden;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#0A1628;");

    var header = el("div",
      "background:" + brand + ";color:#fff;padding:12px 14px;display:flex;" +
      "align-items:center;justify-content:space-between;flex:none;");
    var headerTitle = el("div", "font-weight:600;", name);
    var closeBtn = el("button",
      "background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 2px;",
      "\\u00D7");
    closeBtn.setAttribute("aria-label", "Close chat");
    header.appendChild(headerTitle);
    header.appendChild(closeBtn);

    var body = el("div",
      "flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F8FAFC;");
    var welcomeRow = el("div",
      "align-self:flex-start;max-width:85%;background:#fff;border:1px solid #E2E8F0;" +
      "border-radius:12px;border-top-left-radius:4px;padding:8px 10px;color:#334155;",
      greeting);
    body.appendChild(welcomeRow);

    var identityForm = null;
    var handoffBtn = null;
    var inputRow = null;
    var input = null;
    var sendBtn = null;

    function needsIdentity() {
      return (collectName && !storedName) || (collectEmail && !storedEmail);
    }

    function renderMessages() {
      while (body.childNodes.length > 1) body.removeChild(body.lastChild);
      /* Once the visitor has sent or received a message the greeting has
         done its job — hide it so the thread starts with the real chat. */
      welcomeRow.style.display = messages.length ? "none" : "";
      messages.forEach(function (msg) {
        var mine = msg.sender_type === "customer";
        var bubble = el("div",
          "align-self:" + (mine ? "flex-end" : "flex-start") + ";max-width:85%;" +
          "border-radius:12px;padding:8px 10px;white-space:pre-wrap;word-break:break-word;" +
          (mine
            ? "background:" + brand + ";color:#fff;border-top-right-radius:4px;"
            : "background:#fff;border:1px solid #E2E8F0;color:#334155;border-top-left-radius:4px;"),
          msg.body);
        body.appendChild(bubble);
      });
      body.scrollTop = body.scrollHeight;
    }

    function note(text) {
      var row = el("div",
        "align-self:center;max-width:95%;font-size:12px;color:#64748B;text-align:center;",
        text);
      body.appendChild(row);
      body.scrollTop = body.scrollHeight;
    }

    function fetchMessages() {
      if (!conversationId) return;
      api("/api/widget/conversations/" + encodeURIComponent(conversationId) + "/messages")
        .then(function (payload) {
          var list = payload.messages || [];
          var lastId = messages.length ? messages[messages.length - 1].id : null;
          messages = list;
          renderMessages();
          if (list.length && list[list.length - 1].id !== lastId) {
            /* New agent message arrived; it is already rendered above. */
          }
        })
        .catch(function () { /* Poll failures are silent; retry next round. */ });
    }

    function startPolling() {
      stopPolling();
      pollTimer = window.setInterval(fetchMessages, POLL_MS);
    }
    function stopPolling() {
      if (pollTimer) { window.clearInterval(pollTimer); pollTimer = null; }
    }

    function sendMessage() {
      var text = input.value.trim();
      if (!text || sending) return;
      if (text.length > MAX_MESSAGE_LENGTH) {
        note("Message is too long (max 5,000 characters).");
        return;
      }
      if (needsIdentity()) {
        note("Please add your name and email first.");
        return;
      }
      sending = true;
      sendBtn.disabled = true;
      var payload = { body: text };

      var request;
      if (!conversationId) {
        request = api("/api/widget/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: workspaceId,
            name: storedName || undefined,
            email: storedEmail || undefined,
            message: text
          })
        }).then(function (result) {
          conversationId = result.conversationId;
          save("conversation", conversationId);
        });
      } else {
        request = api("/api/widget/conversations/" + encodeURIComponent(conversationId) + "/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      request.then(function () {
        input.value = "";
        messages.push({ id: "local-" + Date.now(), sender_type: "customer", body: text });
        renderMessages();
        note("Message sent \\u2014 an agent will reply here.");
        fetchMessages();
      }).catch(function () {
        note("Could not send the message. Please try again.");
      }).then(function () {
        sending = false;
        sendBtn.disabled = false;
        input.focus();
      });
    }

    function requestHandoff() {
      if (!conversationId) {
        note("Send a message first, then ask for a human agent.");
        return;
      }
      if (handoffRequested) {
        note("A human agent has already been notified.");
        return;
      }
      handoffBtn.disabled = true;
      api("/api/widget/conversations/" + encodeURIComponent(conversationId) + "/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }).then(function () {
        handoffRequested = true;
        save("handoff", "1");
        note("A human agent has been notified and will reply here.");
      }).catch(function () {
        note("Could not notify a human agent. Please try again.");
        handoffBtn.disabled = false;
      });
    }

    function buildFooter() {
      var footer = el("div", "flex:none;border-top:1px solid #E2E8F0;padding:10px;background:#fff;");

      if (needsIdentity()) {
        identityForm = el("form", "display:flex;flex-direction:column;gap:8px;");
        if (collectName) {
          var nameInput = el("input");
          nameInput.setAttribute("type", "text");
          nameInput.setAttribute("placeholder", "Your name");
          nameInput.setAttribute("maxlength", "200");
          nameInput.setAttribute("style", "border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;");
          if (storedName) nameInput.value = storedName;
          identityForm.appendChild(nameInput);
        }
        if (collectEmail) {
          var emailInput = el("input");
          emailInput.setAttribute("type", "email");
          emailInput.setAttribute("placeholder", "Your email");
          emailInput.setAttribute("maxlength", "254");
          emailInput.setAttribute("style", "border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;");
          if (storedEmail) emailInput.value = storedEmail;
          identityForm.appendChild(emailInput);
        }
        var saveBtn = el("button",
          "background:" + brand + ";color:#fff;border:none;border-radius:8px;" +
          "padding:8px 10px;font-size:14px;cursor:pointer;font-family:inherit;",
          "Start chatting");
        saveBtn.setAttribute("type", "submit");
        identityForm.appendChild(saveBtn);
        identityForm.addEventListener("submit", function (event) {
          event.preventDefault();
          var inputs = identityForm.getElementsByTagName("input");
          for (var i = 0; i < inputs.length; i++) {
            var field = inputs[i];
            if (field.getAttribute("type") === "text" && field.value.trim()) {
              storedName = field.value.trim();
              save("name", storedName);
            }
            if (field.getAttribute("type") === "email" && field.value.trim()) {
              storedEmail = field.value.trim().toLowerCase();
              save("email", storedEmail);
            }
          }
          if (needsIdentity()) {
            note("Please add your name and email to start chatting.");
            return;
          }
          footer.removeChild(identityForm);
          identityForm = null;
          footer.appendChild(buildChatRow());
          footer.appendChild(buildHandoffRow());
          input.focus();
        });
        footer.appendChild(identityForm);
        return footer;
      }

      footer.appendChild(buildChatRow());
      footer.appendChild(buildHandoffRow());
      return footer;
    }

    function buildChatRow() {
      inputRow = el("div", "display:flex;gap:8px;");
      input = el("input");
      input.setAttribute("type", "text");
      input.setAttribute("placeholder", "Type your message\\u2026");
      input.setAttribute("maxlength", "5000");
      input.setAttribute("style", "flex:1;min-width:0;border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;font-size:14px;font-family:inherit;");
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") { event.preventDefault(); sendMessage(); }
      });
      sendBtn = el("button",
        "background:" + brand + ";color:#fff;border:none;border-radius:8px;" +
        "padding:8px 14px;font-size:14px;cursor:pointer;flex:none;font-family:inherit;",
        "Send");
      sendBtn.setAttribute("type", "button");
      sendBtn.addEventListener("click", sendMessage);
      inputRow.appendChild(input);
      inputRow.appendChild(sendBtn);
      return inputRow;
    }

    function buildHandoffRow() {
      var row = el("div", "margin-top:8px;text-align:center;");
      handoffBtn = el("button",
        "background:transparent;border:none;color:#475569;font-size:12px;" +
        "cursor:pointer;text-decoration:underline;padding:2px;font-family:inherit;",
        handoffRequested ? "Human agent notified" : "Talk to a human");
      handoffBtn.setAttribute("type", "button");
      if (handoffRequested) handoffBtn.disabled = true;
      handoffBtn.addEventListener("click", requestHandoff);
      row.appendChild(handoffBtn);
      return row;
    }

    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(buildFooter());

    function openPanel() {
      panel.style.display = "flex";
      launcher.textContent = "\\u00D7";
      launcher.setAttribute("aria-label", "Close chat");
      if (conversationId) fetchMessages();
      startPolling();
      if (input) input.focus();
    }
    function closePanel() {
      panel.style.display = "none";
      launcher.textContent = "\\uD83D\\uDCAC";
      launcher.setAttribute("aria-label", "Open chat");
      stopPolling();
    }

    launcher.addEventListener("click", function () {
      if (panel.style.display === "flex") closePanel(); else openPanel();
    });
    closeBtn.addEventListener("click", closePanel);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);
    if (conversationId) fetchMessages();
  }
})();`;

export async function GET() {
  return new Response(WIDGET_SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
