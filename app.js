const $ = (selector, scope = document) => scope?.querySelector(selector) || null;
const $$ = (selector, scope = document) => Array.from(scope?.querySelectorAll(selector) || []);

const STORAGE_KEY = "qingning_saved_sets_v1";
const state = {
  generatedQuestions: [],
  lastFocusedElement: null,
  savedSets: [],
  demandConfirmed: false
};

const titles = {
  workspace: "备课工作台",
  library: "我的资料库",
  community: "备课社区",
  review: "教学复盘",
  membership: "会员中心"
};

const questionBank = {
  "选择题": [
    "在直角三角形 ABC 中，∠C = 90°，若 AC = 6，BC = 8，则 AB 的长度是（　）。\nA. 10　B. 12　C. 14　D. 16",
    "下列三组长度中，能构成直角三角形的是（　）。\nA. 3,4,6　B. 5,12,13　C. 6,7,8　D. 8,9,10",
    "一个长方形的长为 12 cm，宽为 5 cm，它的对角线长度是（　）。\nA. 13 cm　B. 14 cm　C. 15 cm　D. 17 cm"
  ],
  "填空题": [
    "若直角三角形两条直角边分别为 9 和 12，则斜边长为 ______。",
    "一块操场从西南角到东北角的直线距离可看作长方形对角线，这类问题常用 ______ 定理解决。",
    "若三角形三边为 7、24、25，则它 ______ 直角三角形。"
  ],
  "解答题": [
    "校园里一块长方形草坪长 15 米、宽 8 米，若沿对角线铺一条小路，需要铺多少米？请写出计算过程。",
    "小明把梯子靠在墙上，梯子长 10 米，梯脚距离墙 6 米，梯子顶端离地多少米？",
    "已知三角形三边长分别为 10、24、26，请判断它是否为直角三角形，并说明理由。"
  ],
  "情境题": [
    "家教课后，学生想从小区门口斜穿到楼下。若两条直角路线分别为 30 米和 40 米，请求最短路线。",
    "一个电视屏幕宽 45 cm、对角线 75 cm。请结合勾股定理求屏幕长度，并说明每一步的依据。",
    "请结合“操场抄近路”的生活场景，设计一道需要使用勾股定理的应用题，并给出解法。"
  ]
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadSavedSets();
  bindNavigation();
  bindPrompt();
  bindTaskFlow();
  bindSourceTabs();
  bindSearch();
  bindUpload();
  bindGenerator();
  bindModals();
  bindSecondaryActions();
  patchMobileTableLabels();
  renderSavedSets();
  updateSelectedMaterialCount();
}

function bindNavigation() {
  $$("[data-view]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      switchView(button.dataset.view);
    });
  });

  $("#globalSearch")?.addEventListener("click", () => {
    switchView("library");
    setTimeout(() => $(".filter-search input")?.focus(), 250);
  });

  $(".mobile-menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));

  $("#newLessonBtn")?.addEventListener("click", () => {
    switchView("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function switchView(viewName) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === viewName));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === viewName));
  const title = $("#viewTitle");
  if (title) title.textContent = titles[viewName] || "青柠备课";
  $("#sidebar")?.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindPrompt() {
  const promptInput = $("#lessonPrompt");
  const charCount = $("#charCount");

  promptInput?.addEventListener("input", () => {
    if (charCount) charCount.textContent = promptInput.value.length;
    state.demandConfirmed = false;
    toggleDemandConfirm(promptInput.value.trim().length > 0);
    updateStep(1);
  });

  $("#exampleBtn")?.addEventListener("click", () => {
    if (!promptInput) return;
    promptInput.value = "为初二学生准备一节 60 分钟的勾股定理复习课。学生基础一般，需要结合校园和生活场景，重点讲解逆定理与常见易错点，并生成由易到难的配套练习。";
    if (charCount) charCount.textContent = promptInput.value.length;
    const query = $("#materialQuery");
    if (query) query.value = "勾股定理实际应用与易错点";
    state.demandConfirmed = false;
    toggleDemandConfirm(true);
    updateStep(1);
    promptInput.focus();
  });

  $$(".quick-tags button").forEach(button => {
    button.addEventListener("click", () => {
      if (!promptInput) return;
      promptInput.value += `${promptInput.value.trim() ? "，" : ""}${button.dataset.add}`;
      if (charCount) charCount.textContent = promptInput.value.length;
      state.demandConfirmed = false;
      toggleDemandConfirm(true);
      updateStep(1);
      promptInput.focus();
    });
  });
}

function bindTaskFlow() {
  $("#jumpToPrompt")?.addEventListener("click", () => {
    updateStep(1);
    $("#lessonPrompt")?.focus();
  });
  $("#confirmDemandBtn")?.addEventListener("click", () => confirmDemandAndContinue());
  $$(".task-step-panel .step-head").forEach(head => {
    head.addEventListener("click", () => {
      const panel = head.closest(".task-step-panel");
      const targetStep = Number(panel?.dataset.step || 1);
      if (!canOpenStep(targetStep)) return;
      updateStep(targetStep);
    });
  });
  $("#skipToGenerateBtn")?.addEventListener("click", () => {
    showToast("未选择资料，将仅根据备课描述生成");
    updateStep(3);
    $("#generateBtn")?.focus();
  });
}

function canOpenStep(targetStep) {
  const promptInput = $("#lessonPrompt");
  if (targetStep > 1 && !promptInput?.value.trim()) {
    showToast("请先填写备课需求");
    updateStep(1);
    promptInput?.focus();
    return false;
  }
  if (targetStep > 1 && !state.demandConfirmed) {
    showToast("请先确认需求，再进入下一步");
    toggleDemandConfirm(true);
    updateStep(1);
    $("#confirmDemandBtn")?.focus();
    return false;
  }
  return true;
}

function toggleDemandConfirm(visible) {
  const row = $("#promptNextRow");
  if (!row) return;
  row.hidden = !visible || state.demandConfirmed;
}

function confirmDemandAndContinue() {
  const promptInput = $("#lessonPrompt");
  if (!promptInput?.value.trim()) {
    showToast("请先填写备课需求");
    promptInput?.focus();
    return;
  }
  state.demandConfirmed = true;
  toggleDemandConfirm(false);
  updateStep(2);
  flashStepComplete(1);
  showToast("已完成需求描述");
  setTimeout(() => $("#materialQuery")?.focus(), 260);
}

function bindSourceTabs() {
  $$(".source-tab").forEach(tab => {
    tab.addEventListener("click", () => activateSourceTab(tab));
    tab.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$(".source-tab");
      const index = tabs.indexOf(tab);
      const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      tabs[nextIndex]?.focus();
      activateSourceTab(tabs[nextIndex]);
    });
  });
}

function activateSourceTab(tab) {
  if (!tab) return;
  $$(".source-tab").forEach(item => {
    item.classList.remove("active");
    item.setAttribute("aria-selected", "false");
  });
  $$(".source-content").forEach(panel => {
    panel.classList.remove("active");
    panel.hidden = true;
  });
  tab.classList.add("active");
  tab.setAttribute("aria-selected", "true");
  const panel = $(`#${tab.dataset.source}-source`);
  if (panel) {
    panel.hidden = false;
    panel.classList.add("active");
  }
}

function bindSearch() {
  $("#searchMaterialBtn")?.addEventListener("click", searchMaterials);
  $("#materialQuery")?.addEventListener("keydown", event => {
    if (event.key === "Enter") searchMaterials();
  });
  $("#materialResults")?.addEventListener("change", event => {
    if (event.target.matches(".context-checkbox")) updateSelectedMaterialCount();
  });
  $("#library-source-source")?.addEventListener("change", event => {
    if (event.target.matches(".context-checkbox")) updateSelectedMaterialCount();
  });
}

function searchMaterials() {
  const queryInput = $("#materialQuery");
  const results = $("#materialResults");
  const query = queryInput?.value.trim();

  if (!query) {
    showToast("先输入一个知识点或资料主题");
    queryInput?.focus();
    return;
  }
  if (!results) return;

  results.innerHTML = '<div class="search-loading"><span class="loader"></span>正在生成本地模拟资料结果...</div>';

  setTimeout(() => {
    const materials = buildMockMaterials(query);
    results.innerHTML = `<div class="result-list">${materials.map(renderMaterialItem).join("")}</div>`;
    const selected = updateSelectedMaterialCount();
    updateStep(selected > 0 ? 3 : 2);
  }, 450);
}

function buildMockMaterials(query) {
  return [
    { source: "教材同步", title: `${query}：核心概念与典型例题`, desc: "人教版八年级下册 · 匹配度 96%", checked: true },
    { source: "中考真题", title: `近五年 ${query} 高频考法汇总`, desc: "去重 18 道题 · 匹配度 92%", checked: true },
    { source: "名校题库", title: `${query} 分层训练与易错分析`, desc: "精选 24 道题 · 匹配度 88%", checked: false },
    { source: "生活情境", title: `${query} 家教课堂导入素材`, desc: "适合一对一讲解 · 匹配度 84%", checked: false },
    { source: "讲义结构", title: `${query} 60 分钟课程提纲`, desc: "知识点、例题、练习建议 · 匹配度 81%", checked: false }
  ];
}

function renderMaterialItem(item) {
  return `
    <label class="material-item">
      <input class="context-checkbox" type="checkbox" ${item.checked ? "checked" : ""}>
      <span class="source-label">${escapeHtml(item.source)}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.desc)}</small>
      </div>
    </label>`;
}

function updateSelectedMaterialCount() {
  const selected = $$(".context-checkbox:checked").length;
  const label = $("#selectedMaterialCount");
  if (label) label.textContent = `已选择 ${selected} 份资料`;
  setMaterialStatus(selected);
  if (selected > 0 && getCurrentFlowStep() === 2) {
    updateStep(3);
    flashStepComplete(2);
  }
  return selected;
}

function bindUpload() {
  const fileInput = $("#fileInput");
  const uploadZone = $("#uploadZone");
  fileInput?.addEventListener("change", () => renderFiles(fileInput.files));
  if (!uploadZone) return;

  ["dragenter", "dragover"].forEach(eventName => {
    uploadZone.addEventListener(eventName, event => {
      event.preventDefault();
      uploadZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach(eventName => {
    uploadZone.addEventListener(eventName, event => {
      event.preventDefault();
      uploadZone.classList.remove("dragging");
    });
  });
  uploadZone.addEventListener("drop", event => renderFiles(event.dataTransfer.files));
}

function renderFiles(files) {
  const fileList = $("#fileList");
  if (!fileList || !files?.length) return;

  const pickedFiles = Array.from(files);
  if (pickedFiles.length > 5) showToast("建议每次最多选择 5 份资料");

  fileList.innerHTML = pickedFiles.map(file => {
    const extension = getFileExtension(file.name);
    return `
      <div class="file-item">
        <span class="doc-icon purple">${escapeHtml(extension)}</span>
        <div>
          <strong>${escapeHtml(file.name)}</strong>
          <small class="file-meta">${formatFileSize(file.size)} · ${escapeHtml(getFileTypeLabel(extension))}</small>
        </div>
        <span>已加入本次生成上下文</span>
      </div>`;
  }).join("");
  updateStep(2);
  showToast(`已加入 ${pickedFiles.length} 份资料上下文`);
}

function getFileExtension(fileName) {
  return (fileName.split(".").pop()?.toUpperCase() || "FILE").slice(0, 4);
}

function getFileTypeLabel(extension) {
  const typeMap = { PDF: "PDF 文档", DOC: "Word 文档", DOCX: "Word 文档", PPT: "PPT 演示", PPTX: "PPT 演示", TXT: "文本资料" };
  return typeMap[extension] || "未知类型";
}

function formatFileSize(size) {
  if (size >= 1048576) return `${(size / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function bindGenerator() {
  const range = $("#questionCount");
  range?.addEventListener("input", () => {
    const label = $("#questionCountLabel");
    if (label) label.textContent = `${range.value} 题`;
  });

  $("#selectAllTypes")?.addEventListener("click", () => {
    const checks = $$("#questionTypes input");
    const shouldCheck = checks.some(check => !check.checked);
    checks.forEach(check => check.checked = shouldCheck);
    const button = $("#selectAllTypes");
    if (button) button.textContent = shouldCheck ? "取消全选" : "全选";
  });

  $("#generateBtn")?.addEventListener("click", () => handleGenerate());
  $("#copyAllBtn")?.addEventListener("click", copyAllQuestions);
  $("#printBtn")?.addEventListener("click", printResult);
  $("#regenerateBtn")?.addEventListener("click", () => handleGenerate({ regenerate: true }));
  $("#saveCloudBtn")?.addEventListener("click", saveToLibrary);
  $("#generatedQuestions")?.addEventListener("input", event => {
    if (event.target.matches("textarea")) autoGrowTextarea(event.target);
  });
  $("#generatedQuestions")?.addEventListener("click", event => {
    const action = event.target.closest("[data-question-action]");
    if (!action) return;
    const article = event.target.closest(".editable-question");
    if (!article) return;
    const id = Number(article.dataset.id);
    if (action.dataset.questionAction === "copy") copySingleQuestion(id);
    if (action.dataset.questionAction === "delete") deleteQuestion(id);
  });
}

function handleGenerate(options = {}) {
  if (!validateGenerationForm()) return;
  const selectedCount = updateSelectedMaterialCount();
  if (selectedCount === 0 && !options.regenerate) showToast("未选择资料，将仅根据备课描述生成");

  setGenerateLoading(true);
  updateStep(3, "loading");

  setTimeout(() => {
    state.generatedQuestions = generateQuestions();
    renderGeneratedQuestions(state.generatedQuestions);
    setGenerateLoading(false);
    updateStep(3, "done");
    flashStepComplete(3);
    openModal($("#resultModal"));
    showToast(options.regenerate ? "已重新生成一版习题" : "已生成可编辑习题");
  }, 500);
}

function validateGenerationForm() {
  const promptInput = $("#lessonPrompt");
  const countInput = $("#questionCount");
  const checkedTypes = getSelectedTypes();

  if (!promptInput?.value.trim()) {
    showToast("备课要求不能为空");
    promptInput?.focus();
    return false;
  }
  if (!state.demandConfirmed) {
    state.demandConfirmed = true;
    toggleDemandConfirm(false);
  }
  if (!checkedTypes.length) {
    showToast("至少选择一种题型");
    $("#questionTypes input")?.focus();
    return false;
  }
  const count = Number(countInput?.value);
  if (!Number.isFinite(count) || count < 5 || count > 30) {
    showToast("题目数量必须在 5-30 范围内");
    countInput?.focus();
    return false;
  }
  return true;
}

function getSelectedTypes() {
  return $$("#questionTypes input:checked").map(input => input.value);
}

function generateQuestions() {
  const count = Number($("#questionCount")?.value || 12);
  const types = getSelectedTypes();
  const prompt = $("#lessonPrompt")?.value.trim() || "本次家教练习";
  const topic = inferTopic(prompt);

  return Array.from({ length: count }, (_, index) => {
    const difficulty = getDifficulty(index, count);
    const type = types[index % types.length];
    const stems = questionBank[type] || questionBank["解答题"];
    const stem = adaptStem(stems[index % stems.length], topic, type, index);
    return {
      id: index + 1,
      difficulty,
      type,
      stem,
      answer: buildAnswer(type, index),
      analysis: buildAnalysis(difficulty, type, topic)
    };
  });
}

function inferTopic(prompt) {
  const candidates = ["勾股定理", "过去进行时", "浮力", "一次函数", "阅读理解", "分式方程"];
  return candidates.find(topic => prompt.includes(topic)) || "本节知识点";
}

function getDifficulty(index, total) {
  const ratio = (index + 1) / total;
  if (ratio <= 0.5) return "基础";
  if (ratio <= 0.85) return "进阶";
  return "挑战";
}

function adaptStem(stem, topic, type, index) {
  if (topic === "勾股定理") return stem;
  if (type === "情境题") return stem.replaceAll("勾股定理", topic);
  return `${topic}练习 ${index + 1}：${stem}`;
}

function buildAnswer(type, index) {
  if (type === "选择题") return ["A", "B", "C", "D"][index % 4];
  if (type === "填空题") return ["15", "勾股", "是", "13"][index % 4];
  return "先找出直角三角形关系，再代入公式计算，最后写出完整结论。";
}

function buildAnalysis(difficulty, type, topic) {
  const prefix = difficulty === "基础" ? "先确认已知条件和所求量" : difficulty === "进阶" ? "注意把实际情境转化为数学关系" : "需要综合判断条件是否足够，并说明理由";
  const method = type === "选择题" ? "可通过直接计算和排除法验证选项。" : "建议写清关键步骤，避免只给结果。";
  return `${prefix}。本题考查${topic}的核心应用，${method}对基础一般的学生，可提醒其先画图、标直角边和斜边。`;
}

function renderGeneratedQuestions(questions) {
  const container = $("#generatedQuestions");
  if (!container) return;
  const topic = inferTopic($("#lessonPrompt")?.value || "");
  $("#paperCount") && ($("#paperCount").textContent = `共 ${questions.length} 题`);
  $("#paperTitle") && ($("#paperTitle").textContent = `${topic}分层练习`);
  $("#paperMeta") && ($("#paperMeta").textContent = `${getSelectedTypes().join(" / ")} · 可编辑 · ${new Date().toLocaleDateString("zh-CN")}`);

  container.innerHTML = questions.map(renderQuestionCard).join("");
  $$("#generatedQuestions textarea").forEach(autoGrowTextarea);
}

function renderQuestionCard(question) {
  return `
    <article class="editable-question" data-id="${question.id}">
      <div class="question-side">
        <span class="question-number">${String(question.id).padStart(2, "0")}</span>
        <button type="button" class="tiny-action" data-question-action="copy" aria-label="复制第 ${question.id} 题">复制</button>
        <button type="button" class="tiny-action danger" data-question-action="delete" aria-label="删除第 ${question.id} 题">删除</button>
      </div>
      <div class="question-main">
        <div class="question-meta">
          <span class="tag ${getDifficultyClass(question.difficulty)}">${question.difficulty}</span>
          <span class="tag type">${question.type}</span>
        </div>
        <div class="editable-field">
          <label for="stem-${question.id}">题干</label>
          <textarea id="stem-${question.id}" data-field="stem">${escapeHtml(question.stem)}</textarea>
        </div>
        <div class="editable-field">
          <label for="answer-${question.id}">答案</label>
          <textarea id="answer-${question.id}" data-field="answer">${escapeHtml(question.answer)}</textarea>
        </div>
        <div class="editable-field">
          <label for="analysis-${question.id}">解析</label>
          <textarea id="analysis-${question.id}" data-field="analysis">${escapeHtml(question.analysis)}</textarea>
        </div>
      </div>
    </article>`;
}

function getDifficultyClass(difficulty) {
  return difficulty === "基础" ? "easy" : difficulty === "进阶" ? "medium" : "hard";
}

function autoGrowTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.max(58, textarea.scrollHeight)}px`;
}

function getEditedQuestions() {
  return $$(".editable-question").map((article, index) => {
    const id = Number(article.dataset.id);
    const original = state.generatedQuestions.find(question => question.id === id) || {};
    return {
      ...original,
      id: index + 1,
      stem: $('[data-field="stem"]', article)?.value || "",
      answer: $('[data-field="answer"]', article)?.value || "",
      analysis: $('[data-field="analysis"]', article)?.value || ""
    };
  });
}

function copySingleQuestion(id) {
  const question = getEditedQuestions().find(item => item.id === id) || getEditedQuestions()[id - 1];
  if (!question) return showToast("这道题暂不可复制");
  copyText(buildQuestionsText([question]))
    .then(() => showToast(`已复制第 ${id} 题`))
    .catch(() => showToast("复制失败，请手动选择文本复制"));
}

function deleteQuestion(id) {
  const article = $(`.editable-question[data-id="${id}"]`);
  if (!article) return;
  article.remove();
  renumberQuestionCards();
  showToast(`已删除第 ${id} 题`);
}

function renumberQuestionCards() {
  $$(".editable-question").forEach((article, index) => {
    const nextId = index + 1;
    article.dataset.id = String(nextId);
    $(".question-number", article).textContent = String(nextId).padStart(2, "0");
  });
  const count = $$(".editable-question").length;
  $("#paperCount") && ($("#paperCount").textContent = `共 ${count} 题`);
}

function copyAllQuestions() {
  const questions = getEditedQuestions();
  if (!questions.length) return showToast("暂无可复制的题目");
  copyText(buildQuestionsText(questions))
    .then(() => showToast("已复制全部题目"))
    .catch(() => showToast("复制失败，请手动选择文本复制"));
}

function buildQuestionsText(questions) {
  return questions.map(question => [
    `${String(question.id).padStart(2, "0")}. [${question.difficulty} · ${question.type}]`,
    `题干：${question.stem}`,
    `答案：${question.answer}`,
    `解析：${question.analysis}`
  ].join("\n")).join("\n\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function printResult() {
  if (!getEditedQuestions().length) return showToast("暂无可打印的题目");
  window.print();
}

function saveToLibrary() {
  const questions = getEditedQuestions();
  if (!questions.length) return showToast("暂无可保存的题目");

  const topic = inferTopic($("#lessonPrompt")?.value || "");
  const savedSet = {
    id: Date.now(),
    title: `${topic}分层练习 · ${questions.length} 题`,
    topic,
    count: questions.length,
    createdAt: new Date().toISOString(),
    questions
  };

  state.savedSets.unshift(savedSet);
  persistSavedSets();
  renderSavedSets();
  closeModal($("#resultModal"));
  showToast("已保存到资料库");
  setTimeout(() => switchView("library"), 450);
}

function loadSavedSets() {
  try {
    state.savedSets = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    state.savedSets = [];
  }
}

function persistSavedSets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedSets.slice(0, 20)));
}

function renderSavedSets() {
  const table = $("#libraryTable");
  const savedText = $("#savedCountText");
  if (savedText) savedText.textContent = `${state.savedSets.length} 套练习 · 本地保存`;
  if (!table) return;

  $$(".table-row.generated-row", table).forEach(row => row.remove());
  state.savedSets.forEach(set => {
    const row = document.createElement("div");
    row.className = "table-row generated-row";
    row.innerHTML = `
      <div><span class="doc-icon green">AI</span><strong>${escapeHtml(set.title)}</strong></div>
      <span data-label="归属">MVP 测试保存</span>
      <span data-label="类型">AI 生成</span>
      <span data-label="最近使用">${formatDate(set.createdAt)}</span>
      <button class="protected-action" type="button" data-open-saved="${set.id}">打开</button>`;
    table.appendChild(row);
  });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function setGenerateLoading(isLoading) {
  const button = $("#generateBtn");
  if (!button) return;
  button.classList.toggle("loading", isLoading);
  $("span", button) && ($("span", button).textContent = isLoading ? "正在生成可编辑习题" : "开始生成习题");
  $("small", button) && ($("small", button).textContent = isLoading ? "本地模拟" : "MVP 模拟");
}

function updateStep(activeStep, generateState = "") {
  $$(".step").forEach((step, index) => step.classList.toggle("active", index < activeStep));
  updateTaskPanels(activeStep, generateState);
  updateFlowStatus(activeStep, generateState);
}

function updateTaskPanels(activeStep, generateState = "") {
  $$(".task-step-panel").forEach(panel => {
    const step = Number(panel.dataset.step);
    panel.classList.toggle("active", step === activeStep);
    panel.classList.toggle("done", step < activeStep);
    panel.classList.toggle("collapsed", step > activeStep);
  });
  const step1State = $("#step1State");
  const step2State = $("#step2State");
  const step3State = $("#step3State");
  if (step1State) step1State.textContent = state.demandConfirmed ? "已完成" : activeStep === 1 ? "进行中" : "待确认";
  if (step2State) step2State.textContent = activeStep > 2 ? "已完成" : activeStep === 2 ? "进行中" : "待开始";
  if (step3State) step3State.textContent = generateState === "loading" ? "正在生成" : generateState === "done" ? "已完成" : activeStep === 3 ? "准备生成" : "待开始";
}

function updateFlowStatus(activeStep, generateState = "") {
  const hasDemand = Boolean($("#lessonPrompt")?.value.trim());
  const demandDone = state.demandConfirmed;
  const selected = $$(".context-checkbox:checked").length;
  setStatusItem($("#statusDemand"), demandDone ? "done" : activeStep === 1 ? "active" : "", demandDone ? "已完成需求描述" : hasDemand ? "有内容，待确认" : "等待输入");
  setStatusItem($("#statusMaterials"), selected > 0 ? "done" : activeStep === 2 ? "active" : "", selected > 0 ? `已选择 ${selected} 份资料` : activeStep >= 2 ? "可跳过资料" : "未选择");
  const generateText = generateState === "loading" ? "正在生成" : generateState === "done" ? "已生成完成" : "未开始";
  const generateClass = generateState === "loading" ? "loading active" : generateState === "done" ? "done" : activeStep === 3 ? "active" : "";
  setStatusItem($("#statusGenerate"), generateClass, generateText);
  const summary = $("#flowSummary");
  if (summary) {
    if (generateState === "done") summary.textContent = `已生成 ${$$(".editable-question").length || state.generatedQuestions.length} 道题，可编辑保存`;
    else if (generateState === "loading") summary.textContent = "正在生成练习，请稍等";
    else if (selected > 0) summary.textContent = `已选择 ${selected} 份资料，下一步即可生成`;
    else if (demandDone) summary.textContent = "需求已确认，可以选择资料或直接生成";
    else if (hasDemand) summary.textContent = "需求已输入，点击确认进入下一步";
    else summary.textContent = "预计 1 分钟完成首版练习";
  }
}

function setMaterialStatus(selected) {
  const step2State = $("#step2State");
  if (step2State && selected > 0) step2State.textContent = `已选择 ${selected} 份`;
  updateFlowStatus(getCurrentFlowStep());
}

function getCurrentFlowStep() {
  const active = $(".task-step-panel.active");
  return Number(active?.dataset.step || 1);
}

function setStatusItem(item, statusClass, text) {
  if (!item) return;
  item.classList.remove("active", "done", "loading");
  statusClass.split(" ").filter(Boolean).forEach(name => item.classList.add(name));
  const em = $("em", item);
  if (em) em.textContent = text;
}

function flashStepComplete(stepNumber) {
  const panel = $(`.task-step-panel[data-step="${stepNumber}"]`);
  const status = stepNumber === 1 ? $("#statusDemand") : stepNumber === 2 ? $("#statusMaterials") : $("#statusGenerate");
  [panel, status].forEach(element => {
    if (!element) return;
    element.classList.remove("just-completed");
    void element.offsetWidth;
    element.classList.add("just-completed");
    setTimeout(() => element.classList.remove("just-completed"), 1100);
  });
}

function bindModals() {
  $$(".modal-close").forEach(button => {
    button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
  });

  $$(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", event => {
      if (event.target === backdrop) closeModal(backdrop);
    });
  });

  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      switchView("library");
      setTimeout(() => $(".filter-search input")?.focus(), 250);
    }
    if (event.key === "Escape") {
      $$(".modal-backdrop.open").forEach(modal => closeModal(modal));
      $("#sidebar")?.classList.remove("open");
    }
  });
}

function openModal(modal) {
  if (!modal) return;
  state.lastFocusedElement = document.activeElement;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => $(".modal-close", modal)?.focus(), 30);
}

function closeModal(modal, restoreFocus = true) {
  if (!modal) return;
  modal.classList.remove("open");
  if (!$(".modal-backdrop.open")) document.body.style.overflow = "";
  if (restoreFocus) state.lastFocusedElement?.focus?.();
}

function bindSecondaryActions() {
  $("#shareBtn")?.addEventListener("click", () => openModal($("#shareModal")));

  $("#publishBtn")?.addEventListener("click", () => {
    const title = $("#shareModal input")?.value.trim();
    if (!title) {
      showToast("先给这条经验起个标题");
      $("#shareModal input")?.focus();
      return;
    }
    closeModal($("#shareModal"));
    showToast("经验已发布，正在接受社区审核");
  });

  $("#libraryTable")?.addEventListener("click", event => {
    const openButton = event.target.closest("[data-open-saved]");
    if (openButton) {
      openSavedSet(Number(openButton.dataset.openSaved));
      return;
    }
    if (event.target.closest(".protected-action")) showToast("已在受保护的云端阅读器中打开");
  });

  $$(".buy-button").forEach(button => {
    button.addEventListener("click", () => showToast("已打开模拟支付流程"));
  });
}

function openSavedSet(id) {
  const set = state.savedSets.find(item => item.id === id);
  if (!set) return showToast("没有找到这套练习");
  state.generatedQuestions = set.questions;
  renderGeneratedQuestions(state.generatedQuestions);
  $("#paperTitle") && ($("#paperTitle").textContent = set.title);
  openModal($("#resultModal"));
}

function resetWorkspace() {
  const promptInput = $("#lessonPrompt");
  const charCount = $("#charCount");
  const queryInput = $("#materialQuery");
  const results = $("#materialResults");
  const fileList = $("#fileList");

  if (promptInput) promptInput.value = "";
  state.demandConfirmed = false;
  if (charCount) charCount.textContent = "0";
  if (queryInput) queryInput.value = "";
  if (fileList) fileList.innerHTML = "";
  if (results) {
    results.innerHTML = `
      <div class="empty-material">
        <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16v13H4Z"/><path d="m8 6 1.5-2h5L16 6M8 11h8M8 15h5"/></svg></span>
        <div><strong>先搜索一个知识点</strong><p>当前为 MVP 前端演示，搜索结果为本地模拟数据。</p></div>
      </div>`;
  }
  $$("#questionTypes input").forEach((input, index) => input.checked = index < 3);
  const range = $("#questionCount");
  if (range) range.value = "12";
  $("#questionCountLabel") && ($("#questionCountLabel").textContent = "12 题");
  toggleDemandConfirm(false);
  updateSelectedMaterialCount();
  updateStep(1);
}

function patchMobileTableLabels() {
  $$(".table-row").forEach(row => {
    const spans = Array.from(row.children).filter(child => child.tagName === "SPAN");
    ["归属", "类型", "最近使用"].forEach((label, index) => {
      spans[index]?.setAttribute("data-label", label);
    });
  });
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  const text = $("#toast p");
  if (!toast || !text) return;
  clearTimeout(toastTimer);
  text.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
