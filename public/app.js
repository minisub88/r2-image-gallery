const folderGrid = document.querySelector("#folder-grid");
const imageGrid = document.querySelector("#image-grid");
const statusEl = document.querySelector("#status");
const titleEl = document.querySelector("#section-title");
const crumbs = document.querySelector("#crumbs");
const empty = document.querySelector("#empty");
const searchWrap = document.querySelector("#search-wrap");
const search = document.querySelector("#search");
const viewer = document.querySelector("#viewer");
const largeImage = document.querySelector("#large-image");
const largeName = document.querySelector("#large-name");
const openOriginal = document.querySelector("#open-original");

let currentParent = "";
let currentFolder = "";
let images = [];
let visibleImages = [];
let viewerIndex = 0;

function setStatus(message) {
  statusEl.textContent = message;
}

function showEmpty(message) {
  empty.hidden = false;
  empty.textContent = message;
}

function renderCrumbs() {
  crumbs.replaceChildren();

  const home = document.createElement("button");
  home.textContent = "전체 폴더";
  home.addEventListener("click", () => loadFolders(""));

  crumbs.append(home);

  if (currentParent) {
    const sep = document.createElement("span");
    sep.textContent = "/";

    const parentButton = document.createElement("button");
    parentButton.textContent = currentParent;
    parentButton.addEventListener("click", () =>
      loadFolders(currentParent)
    );

    crumbs.append(sep, parentButton);
  }

  if (currentFolder) {
    const sep = document.createElement("span");
    sep.textContent = "/";

    const leaf = document.createElement("span");
    leaf.textContent = currentFolder.split("/").at(-1);

    crumbs.append(sep, leaf);
  }
}

async function getJson(path) {
  const response = await fetch(path);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function loadFolders(parent) {
  currentParent = parent;
  currentFolder = "";
  images = [];

  folderGrid.hidden = false;
  imageGrid.hidden = true;
  searchWrap.hidden = true;

  folderGrid.replaceChildren();
  imageGrid.replaceChildren();

  empty.hidden = true;

  titleEl.textContent = parent
    ? `${parent} 하위 폴더`
    : "첫 번째 폴더";

  setStatus("폴더 목록을 불러오는 중...");
  renderCrumbs();

  try {
    const data = await getJson(
      `/api/folders?parent=${encodeURIComponent(parent)}`
    );

    setStatus(`${data.folders.length}개 폴더`);

    if (!data.folders.length) {
      return showEmpty("폴더가 없습니다.");
    }

    empty.hidden = true;

    for (const name of data.folders) {
      const fullPath = parent
        ? `${parent}/${name}`
        : name;

      const button = document.createElement("button");
      button.className = "folder-card";

      const icon = document.createElement("span");
      icon.className = "folder-icon";
      icon.textContent = "▰";

      const label = document.createElement("span");
      label.textContent = name;

      button.append(icon, label);

      button.addEventListener("click", () => {
        if (!parent) {
          loadFolders(fullPath);
        } else {
          loadImages(fullPath);
        }
      });

      folderGrid.append(button);
    }
  } catch (error) {
    setStatus("폴더를 불러오지 못했습니다.");
    showEmpty(error.message);
  }
}

async function loadImages(folder) {
  currentFolder = folder;

  folderGrid.hidden = true;
  imageGrid.hidden = false;

  imageGrid.replaceChildren();
  empty.hidden = true;

  searchWrap.hidden = false;
  search.value = "";

  titleEl.textContent = folder;
  setStatus("이미지 목록을 불러오는 중...");

  renderCrumbs();

  try {
    const data = await getJson(
      `/api/images?folder=${encodeURIComponent(folder)}`
    );

    images = data.images;
    renderImages();
  } catch (error) {
    setStatus("이미지를 불러오지 못했습니다.");
    showEmpty(error.message);
  }
}

function renderImages() {
  const query = search.value.trim().toLowerCase();

  visibleImages = images.filter(item =>
    item.name.toLowerCase().includes(query)
  );

  imageGrid.replaceChildren();

  setStatus(
    `${visibleImages.length} / ${images.length}개 이미지`
  );

  empty.hidden = visibleImages.length > 0;

  if (!visibleImages.length) {
    empty.textContent = images.length
      ? "검색 결과가 없습니다."
      : "이 폴더에는 이미지가 없습니다.";

    return;
  }

  visibleImages.forEach((item, index) => {
    const card = document.createElement("button");
    card.className = "image-card";
    card.type = "button";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = item.url;
    img.alt = item.name;

    const name = document.createElement("span");
    name.className = "filename";
    name.textContent = item.name;

    card.append(img, name);

    card.addEventListener("click", () =>
      openViewer(index)
    );

    imageGrid.append(card);
  });
}

function openViewer(index) {
  if (!visibleImages.length) return;

  viewerIndex =
    (index + visibleImages.length) % visibleImages.length;

  const item = visibleImages[viewerIndex];

  largeImage.src = item.url;
  largeImage.alt = item.name;

  largeName.textContent = item.name;
  openOriginal.href = item.url;

  viewer.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeViewer() {
  viewer.hidden = true;
  largeImage.src = "";
  document.body.style.overflow = "";
}

function moveViewer(delta) {
  openViewer(viewerIndex + delta);
}

document.querySelector("#close-viewer")
  .addEventListener("click", closeViewer);

document.querySelector("#prev-image")
  .addEventListener("click", () => moveViewer(-1));

document.querySelector("#next-image")
  .addEventListener("click", () => moveViewer(1));

search.addEventListener("input", renderImages);

viewer.addEventListener("click", event => {
  if (event.target === viewer) closeViewer();
});

document.addEventListener("keydown", event => {
  if (viewer.hidden) return;

  if (event.key === "Escape") closeViewer();
  if (event.key === "ArrowLeft") moveViewer(-1);
  if (event.key === "ArrowRight") moveViewer(1);
});

loadFolders("");
