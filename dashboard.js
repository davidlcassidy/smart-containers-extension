document.addEventListener("DOMContentLoaded", async () => {
  let CONTAINER_CONFIG = {};
  const CONTAINER_COLOR_OPTIONS = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];

  let data = await browser.storage.local.get("containerSettings");
  let localContainerSettings = data.containerSettings || {};

  try {
    const response = await fetch(browser.runtime.getURL("configs/containers.json"));
    CONTAINER_CONFIG = await response.json();
    generateDashboard();
  } catch (error) {
    console.error("Error loading JSON:", error);
  }
  
  function generateDashboard() {
    const categoryDiv = document.getElementById("categories");
    categoryDiv.innerHTML = "";
    const categories = {};

    // Group containers by category
    CONTAINER_CONFIG.containers.forEach((container) => {
      if (!categories[container.category]) {
        categories[container.category] = [];
      }
      categories[container.category].push(container);
    });

    Object.keys(categories).sort().forEach((category) => {
      const categoryContainer = document.createElement("div");
      categoryContainer.classList.add("category-container");

      const categoryButton = document.createElement("button");
      categoryButton.classList.add("category-button");

      const enabledCount = categories[category].filter(container => localContainerSettings[container.name]?.enabled ?? container.enabledDefault).length;
      const disabledCount = categories[category].length - enabledCount;
      categoryButton.innerHTML = `${category} 
                                  <span class="category-counts">
                                    <span class="enabled-count" style="color: green;">${enabledCount}</span>
                                    /<span class="disabled-count" style="color: red;">${disabledCount}</span>
                                  </span>
                                  <span class="category-caret">^</span>`;

      const siteList = document.createElement("div");
      siteList.classList.add("category-sites");
      siteList.id = `category-${category.replace(/\s+/g, "-")}`;
      siteList.style.display = "none";

      categories[category].forEach((container) => {
        const isContainerEnabled = localContainerSettings[container.name]?.enabled ?? container.enabledDefault;
        const containerBox = createContainerBox(container, isContainerEnabled);
        siteList.appendChild(containerBox);
      });

      categoryButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const isExpanded = siteList.style.display === "block";
        siteList.style.display = isExpanded ? "none" : "block";
        categoryButton.classList.toggle("expanded", !isExpanded);
        categoryButton.querySelector(".category-caret").classList.toggle("rotated", !isExpanded);
      });

      categoryContainer.appendChild(categoryButton);
      categoryContainer.appendChild(siteList);
      categoryDiv.appendChild(categoryContainer);
    });
  }

  function updateCategoryCounts() {
    const categories = document.querySelectorAll(".category-container");

    categories.forEach(category => {
      const categoryButton = category.querySelector(".category-button");
      const categoryName = categoryButton.innerHTML.split('<')[0].trim();

      const containers = CONTAINER_CONFIG.containers.filter(container => container.category === categoryName);
      const enabledCount = containers.filter(container => localContainerSettings[container.name]?.enabled ?? container.enabledDefault).length;
      const disabledCount = containers.length - enabledCount;

      const countsSpan = categoryButton.querySelector(".category-counts");
      countsSpan.innerHTML = `
        <span class="enabled-count" style="color: green;">${enabledCount}</span>
        /<span class="disabled-count" style="color: red;">${disabledCount}</span>
      `;
    });
  }

  function createContainerBox(container, isEnabled) {
    const containerBox = document.createElement("div");
    containerBox.className = `container-box ${isEnabled ? "enabled" : "disabled"}`;
    containerBox.setAttribute("data-name", container.name);

    containerBox.addEventListener("click", async (event) => {
      const isNowEnabled = containerBox.classList.toggle("enabled");
      containerBox.classList.toggle("disabled", !isNowEnabled);
      await saveSettings(container.name, isNowEnabled);

      const colorCircle = containerBox.querySelector(".color-circle");
      if (colorCircle) {
        if (isNowEnabled) {
          colorCircle.classList.remove("hidden");
        } else {
          colorCircle.classList.add("hidden");
        }
      }

      updateCategoryCounts();
    });

    const containerName = document.createElement("span");
    containerName.textContent = container.displayName;
    containerBox.appendChild(containerName);

    let currentColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];

    const colorCircle = document.createElement("div");
    colorCircle.classList.add("color-circle");
    colorCircle.style.backgroundColor = currentColor;

    if (!isEnabled) {
      colorCircle.classList.add("hidden");
    }

    if (isEnabled) {
      colorCircle.addEventListener("click", async (e) => {
        e.stopPropagation();
        let currentIndex = CONTAINER_COLOR_OPTIONS.indexOf(currentColor);
        const nextColor = CONTAINER_COLOR_OPTIONS[(currentIndex + 1) % CONTAINER_COLOR_OPTIONS.length];

        colorCircle.style.backgroundColor = nextColor;

        await saveSettings(container.name, isEnabled, nextColor);

        currentColor = nextColor;
      });
    }

    containerBox.appendChild(colorCircle);

    return containerBox;
  }

  async function saveSettings(name, isEnabled, selectedColor) {
    const container = CONTAINER_CONFIG.containers.find(c => c.displayName === name);
    if (!container) return;

    const savedSettings = localContainerSettings[name] || {};
    savedSettings.enabled = isEnabled;

    if (!isEnabled) {
      savedSettings.color = CONTAINER_COLOR_OPTIONS[0];
    } else if (selectedColor) {
      savedSettings.color = selectedColor;
    }

    localContainerSettings[name] = savedSettings;
    await browser.storage.local.set({ containerSettings: localContainerSettings });

    const allContainers = await browser.contextualIdentities.query({});
    const updatedContainer = allContainers.find(c => c.name === name);
    if (updatedContainer && updatedContainer.cookieStoreId) {
      await browser.contextualIdentities.update(updatedContainer.cookieStoreId, { color: savedSettings.color || CONTAINER_COLOR_OPTIONS[0] });
    }

    updateCategoryCounts();
  }

  document.getElementById("enableAll").addEventListener("click", async () => {
    CONTAINER_CONFIG.containers.forEach(async (container) => {
      await saveSettings(container.name, true);

      const containerBox = document.querySelector(`.container-box[data-name="${container.name}"]`);
      if (containerBox) {
        containerBox.classList.remove("disabled");
        containerBox.classList.add("enabled");
        const colorCircle = containerBox.querySelector(".color-circle");
        if (colorCircle) {
          colorCircle.classList.remove("hidden");
        }
      }
    });
    updateCategoryCounts();
  });

  document.getElementById("disableAll").addEventListener("click", async () => {
    CONTAINER_CONFIG.containers.forEach(async (container) => {
      await saveSettings(container.name, false);

      const containerBox = document.querySelector(`.container-box[data-name="${container.name}"]`);
      if (containerBox) {
        containerBox.classList.remove("enabled");
        containerBox.classList.add("disabled");
        const colorCircle = containerBox.querySelector(".color-circle");
        if (colorCircle) {
          colorCircle.classList.add("hidden");
        }
      }
    });
    updateCategoryCounts();
  });

  document.getElementById("purgeAll").addEventListener("click", async () => {
    for (let container of CONTAINER_CONFIG.containers) {
      const allContainers = await browser.contextualIdentities.query({});
      const containerToDelete = allContainers.find(c => c.name === container.name);
      if (containerToDelete && containerToDelete.cookieStoreId) {
        await browser.contextualIdentities.remove(containerToDelete.cookieStoreId);
      }
    }

    alert("All containers have been permanently deleted.");
  });
});
