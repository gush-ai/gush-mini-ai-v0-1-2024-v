const $ = s => document.querySelector(s);

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function addMessage(text, who, meta = "") {
  const div = document.createElement("div");
  div.className = `message ${who}`;
  div.textContent = text;
  if (meta) {
    const small = document.createElement("small");
    small.textContent = meta;
    div.appendChild(small);
  }
  $("#messages").appendChild(div);
  $("#messages").scrollTop = $("#messages").scrollHeight;
}

async function refreshStats() {
  const health = await api("/api/health");
  const stats = await api("/api/stats");

  $("#teacherBadge").textContent =
    `Teacher: ${health.teacher.enabled && health.teacher.configured ? "ON" : "OFF"} • Local brain: ON`;

  $("#stats").innerHTML = [
    ["Documents", stats.documents],
    ["Sentences", stats.sentences],
    ["Examples", stats.examples],
    ["Vocabulary", stats.vocabulary],
    ["Bigrams", stats.bigrams],
    ["Chats", stats.conversations]
  ].map(([label, value]) => `
    <div class="stat"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>
  `).join("");
}

$("#chatForm").addEventListener("submit", async e => {
  e.preventDefault();
  const message = $("#message").value.trim();
  if (!message) return;
  addMessage(message, "user");
  $("#message").value = "";

  try {
    const result = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ message })
    });
    addMessage(
      result.answer,
      "ai",
      `confidence ${(result.confidence * 100).toFixed(0)}% • ${result.source}`
    );
  } catch (error) {
    addMessage(error.message, "ai");
  }
  refreshStats();
});

$("#teachBtn").addEventListener("click", async () => {
  const input = $("#teachInput").value.trim();
  const output = $("#teachOutput").value.trim();
  try {
    await api("/api/teach", {
      method: "POST",
      body: JSON.stringify({ input, output })
    });
    $("#teachStatus").textContent = "Lesson saved locally.";
    $("#teachInput").value = "";
    $("#teachOutput").value = "";
    refreshStats();
  } catch (error) {
    $("#teachStatus").textContent = error.message;
  }
});

$("#ingestBtn").addEventListener("click", async () => {
  $("#ingestStatus").textContent = "Learning…";
  try {
    const result = await api("/api/ingest/text", {
      method: "POST",
      body: JSON.stringify({
        title: $("#ingestTitle").value.trim() || "Manual text",
        text: $("#ingestText").value,
        useTeacher: $("#useTeacher").checked
      })
    });
    $("#ingestStatus").textContent =
      `Saved ${result.local.sentences} sentences and processed ${result.local.tokensLearned} tokens.` +
      (result.teacher?.saved ? ` Teacher added ${result.teacher.saved} examples.` : "");
    refreshStats();
  } catch (error) {
    $("#ingestStatus").textContent = error.message;
  }
});

$("#testBtn").addEventListener("click", async () => {
  $("#testOutput").textContent = "Testing…";
  try {
    const result = await api("/api/self-test", {
      method: "POST",
      body: JSON.stringify({ limit: 20 })
    });
    $("#testOutput").textContent =
      result.tested
        ? `Tested: ${result.tested}\nPassed: ${result.passed}\nAccuracy: ${(result.accuracy * 100).toFixed(1)}%`
        : result.message;
  } catch (error) {
    $("#testOutput").textContent = error.message;
  }
});

refreshStats();
