(() => {
  "use strict";

  const IMAGE_ORIGIN = "https://maneulbbang.org/";
  const descriptions = window.FOLDER_DESCRIPTIONS || {};

  const el = (id) => document.getElementById(id);

  const state = {
    parent: "",
    currentFolder: "",
    images: [],
    visibleImages: [],
    viewerIndex: -1
  };

  const folderGrid = el("folder-grid");
  const imageGrid = el("image-grid");
  const status = el("status");
  const folderSection = el("folder-section");
  const imageSection = el("image-section");
  const breadcrumbs = el("breadcrumbs");

  // 숫자가 포함된 파일명도 자연스러운 순서로 정렬
  function naturalSort(a, b) {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base"
    });
  }

  function cleanPath(value) {
    return String(value || "").replace(/^\/+|\/+$/g, "");
  }

  // 폴더 설명 대응표에서 해당 폴더의 제목과 설명 가져오기
  function descriptionFor(path) {
    const item = descriptions[path] || {};

    return {
      title: typeof item.title === "string"
        ? item.title.trim() : "",

      description: typeof item.description === "string"
        ? item.description.trim() : ""
    };
  }

  // API에서 받은 폴더 정보를 전체 경로로 변환
  function folderPath(item, parent) {
    if (typeof item === "string") {
      const raw = cleanPath(item);

      if (!raw) return "";

      return parent && !raw.startsWith(parent + "/")
        ? `${parent}/${raw}`
        : raw;
    }

    if (!item || typeof item !== "object") return "";

    const raw = cleanPath(
      item.path ||
      item.prefix ||
      item.key ||
      item.name ||
      item.folder ||
      ""
    );

    if (!raw) return "";

    return parent &&
      !raw.startsWith(parent + "/") &&
      raw !== parent
        ? `${parent}/${raw}`
        : raw;
  }

  function extractFolders(data, parent) {
    const list = Array.isArray(data)
      ? data
      : data && (
          data.folders ||
          data.prefixes ||
          data.directories ||
          data.items
        ) || [];

    return list
      .map(item => folderPath(item, parent))
      .filter(Boolean)
      .filter(path => path !== parent)
      .sort(naturalSort);
  }

  // 이미지의 실제 주소 가져오기
  function imageUrl(item) {
    if (typeof item === "string") {
      if (/^https?:\/\//i.test(item)) {
        return item;
      }

      return IMAGE_ORIGIN +
        item.split("/").map(encodeURIComponent).join("/");
    }

    if (!item || typeof item !== "object") return "";

    const direct =
      item.url ||
      item.publicUrl ||
      item.src ||
      item.imageUrl;

    if (direct) return direct;

    const key =
      item.key ||
      item.name ||
      item.path ||
      item.filename ||
      "";

    if (!key) return "";

    if (/^https?:\/\//i.test(key)) return key;

    return IMAGE_ORIGIN +
      String(key).split("/").map(encodeURIComponent).join("/");
  }

  // 이미지 파일명 가져오기
  function imageName(item, url) {
    if (item && typeof item === "object") {
      const name =
        item.name ||
        item.filename ||
        item.key ||
        item.path;

      if (name) {
        return String(name).split("/").pop();
      }
    }

    try {
      return decodeURIComponent(
        new URL(url).pathname.split("/").pop()
      );
    } catch {
      return String(url).split("/").pop();
    }
  }

  function extractImages(data) {
    const list = Array.isArray(data)
      ? data
      : data && (
          data.images ||
          data.objects ||
          data.files ||
          data.items
        ) || [];

    return list
      .map(item => {
        const url = imageUrl(item);

        return {
          url,
          name: imageName(item, url)
        };
      })
      .filter(item => item.url)
      .sort((a, b) => naturalSort(a.name, b.name));
  }

  // 서버에서 JSON 데이터 가져오기
  async function getJson(url) {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`요청 실패 (${response.status})`);
    }

    return response.json();
  }

  function setStatus(message) {
    status.textContent = message || "";
  }

  // 현재 폴더 위치 표시
  function renderBreadcrumbs() {
    breadcrumbs.replaceChildren();

    const root = document.createElement("button");
    root.type = "button";
    root.textContent = "전체 캐릭터";

    root.addEventListener("click", () => {
      loadFolders("");
    });

    breadcrumbs.append(root);

    if (!state.currentFolder) return;

    const parts = state.currentFolder.split("/");
    let accumulated = "";

    parts.forEach((part, index) => {
      const separator = document.createElement("span");
      separator.textContent = "›";
      breadcrumbs.append(separator);

      accumulated = accumulated
        ? `${accumulated}/${part}`
        : part;

      const path = accumulated;
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = part;

      button.addEventListener("click", () => {
        if (index === parts.length - 1) {
          loadImages(path);
        } else {
          loadFolders(path);
        }
      });

      breadcrumbs.append(button);
    });
  }

  // 폴더 썸네일 영역에 이미지 표시
  function addThumbnailImage(container, item) {
    if (!item || !item.url) return;

    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "";
    img.loading = "lazy";
    img.onerror = () => img.remove();

    container.append(img);
  }

  // 하위 폴더는 첫 번째 이미지,
  // 상위 폴더는 하위 폴더별 이미지 4장을 사용
  async function loadFolderThumbnail(path, container) {
    try {
      if (path.split("/").length >= 2) {
        const data = await getJson(
          `/api/images?folder=${encodeURIComponent(path)}`
        );
        const images = extractImages(data);

        if (container.isConnected && images.length) {
          container.classList.add("single");
          addThumbnailImage(container, images[0]);
        }

        return;
      }

      const data = await getJson(
        `/api/folders?parent=${encodeURIComponent(path)}`
      );
      const childFolders = extractFolders(data, path);

      const imageLists = await Promise.all(
        childFolders.slice(0, 4).map(async childPath => {
          try {
            const imageData = await getJson(
              `/api/images?folder=${encodeURIComponent(childPath)}`
            );
            return extractImages(imageData);
          } catch {
            return [];
          }
        })
      );

      if (!container.isConnected) return;

      container.classList.add("mosaic");
      imageLists.forEach(images => {
        if (images.length) {
          addThumbnailImage(container, images[0]);
        }
      });
    } catch {
      // 썸네일을 불러오지 못해도 폴더 버튼 자체는 정상적으로 사용할 수 있음
    }
  }

  // 폴더 버튼 표시
  function renderFolders(paths) {
    folderGrid.replaceChildren();

    folderSection.hidden = false;
    imageSection.hidden = true;

    if (!paths.length) {
      setStatus("표시할 폴더가 없습니다.");
      return;
    }

    paths.forEach(path => {
      const leaf = path.split("/").pop();
      const info = descriptionFor(path);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "folder-card";

      const thumbnail = document.createElement("span");
      thumbnail.className = "folder-thumbnail";
      thumbnail.setAttribute("aria-hidden", "true");

      const top = document.createElement("span");
      top.className = "folder-card-top";

      const title = document.createElement("span");
      title.className = "folder-title";

      // 대응표에 제목이 있으면 사용하고,
      // 없으면 원래 폴더명을 사용
      title.textContent = info.title || leaf;

      top.append(title);
      button.append(thumbnail, top);

      // 설명이 입력된 폴더만 캡션 표시
      if (info.description) {
        const caption = document.createElement("span");

        caption.className = "folder-description";
        caption.textContent = info.description;

        button.append(caption);
      }

      // 두 단계 구조:
      // 첫 번째 폴더는 하위 폴더 목록,
      // 두 번째 폴더는 이미지 목록 표시
      button.addEventListener("click", () => {
        if (path.split("/").length >= 2) {
          loadImages(path);
        } else {
          loadFolders(path);
        }
      });

      folderGrid.append(button);
      loadFolderThumbnail(path, thumbnail);
    });

    setStatus(`${paths.length}개 폴더`);
  }

  // 폴더 목록 불러오기
  async function loadFolders(parent) {
    state.parent = parent;
    state.currentFolder = parent;

    renderBreadcrumbs();

    folderGrid.replaceChildren();
    folderSection.hidden = false;
    imageSection.hidden = true;

    setStatus("폴더 목록을 불러오는 중입니다.");

    try {
      const query = parent
        ? `?parent=${encodeURIComponent(parent)}`
        : "";

      const data = await getJson(`/api/folders${query}`);
      const paths = extractFolders(data, parent);

      renderFolders(paths);

    } catch (error) {
      setStatus(
        `폴더 목록을 불러오지 못했습니다. ${error.message}`
      );
    }
  }

  // 이미지 목록 불러오기
  async function loadImages(folder) {
    state.currentFolder = folder;

    renderBreadcrumbs();

    folderGrid.replaceChildren();
    folderSection.hidden = true;
    imageSection.hidden = false;

    imageGrid.replaceChildren();

    el("search-input").value = "";

    el("image-heading").textContent =
      `${folder.split("/").pop()} 이미지`;

    setStatus("이미지 목록을 불러오는 중입니다.");

    try {
      const data = await getJson(
        `/api/images?folder=${encodeURIComponent(folder)}`
      );

      state.images = extractImages(data);
      state.visibleImages = state.images.slice();

      renderImages();

      setStatus(`${state.images.length}개 이미지`);

    } catch (error) {
      setStatus(
        `이미지 목록을 불러오지 못했습니다. ${error.message}`
      );
    }
  }

  // 이미지 썸네일 표시
  function renderImages() {
    imageGrid.replaceChildren();

    const items = state.visibleImages;

    el("empty-search").hidden = items.length !== 0;

    items.forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "image-card";

      const img = document.createElement("img");

      img.src = item.url;
      img.alt = item.name;
      img.loading = "lazy";

      img.onerror = () => {
        img.alt = `${item.name} (이미지를 불러올 수 없음)`;
      };

      const name = document.createElement("span");

      name.className = "image-name";
      name.textContent = item.name;

      button.append(img, name);

      button.addEventListener("click", () => {
        openViewer(item);
      });

      imageGrid.append(button);
    });
  }

  // 확대 보기 열기
  function openViewer(item) {
    state.viewerIndex = state.visibleImages.findIndex(
      candidate => candidate.url === item.url
    );

    updateViewer();

    el("viewer").hidden = false;
    document.body.style.overflow = "hidden";
  }

  // 확대 보기 내용 갱신
  function updateViewer() {
    const item = state.visibleImages[state.viewerIndex];

    if (!item) return;

    el("viewer-image").src = item.url;
    el("viewer-image").alt = item.name;

    el("viewer-caption").textContent = item.name;

    el("viewer-original").href = item.url;

    el("viewer-prev").disabled =
      state.visibleImages.length < 2;

    el("viewer-next").disabled =
      state.visibleImages.length < 2;
  }

  // 확대 보기 닫기
  function closeViewer() {
    el("viewer").hidden = true;
    document.body.style.overflow = "";
  }

  // 이전 / 다음 이미지 이동
  function moveViewer(direction) {
    if (!state.visibleImages.length) return;

    state.viewerIndex =
      (state.viewerIndex + direction + state.visibleImages.length)
      % state.visibleImages.length;

    updateViewer();
  }

  // 이용 안내 펼치기 / 접기
  el("guide-toggle").addEventListener("click", () => {
    const panel = el("guide-panel");

    const expanded =
      el("guide-toggle").getAttribute("aria-expanded") === "true";

    el("guide-toggle").setAttribute(
      "aria-expanded",
      String(!expanded)
    );

    panel.hidden = expanded;
  });

  // 파일명 검색
  el("search-input").addEventListener("input", event => {
    const query = event.target.value.trim().toLocaleLowerCase();

    state.visibleImages = state.images.filter(item =>
      item.name.toLocaleLowerCase().includes(query)
    );

    renderImages();

    setStatus(`${state.visibleImages.length}개 이미지`);
  });

  // 확대 보기 버튼 이벤트
  el("viewer-close").addEventListener("click", closeViewer);

  el("viewer-prev").addEventListener("click", () => {
    moveViewer(-1);
  });

  el("viewer-next").addEventListener("click", () => {
    moveViewer(1);
  });

  // 이미지 바깥 영역을 누르면 닫기
  el("viewer").addEventListener("click", event => {
    if (event.target === el("viewer")) {
      closeViewer();
    }
  });

  // 키보드 조작
  document.addEventListener("keydown", event => {
    if (el("viewer").hidden) return;

    if (event.key === "Escape") {
      closeViewer();
    }

    if (event.key === "ArrowLeft") {
      moveViewer(-1);
    }

    if (event.key === "ArrowRight") {
      moveViewer(1);
    }
  });

  // 최초 접속 시 최상위 폴더 목록 표시
  loadFolders("");
})();
