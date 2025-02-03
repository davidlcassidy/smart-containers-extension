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
    CONTAINER_CONFIG.forEach((container) => {
      if (!categories[container.category]) {
        categories[container.category] = [];
      }
      categories[container.category].push(container);
    });
	console.log(JSON.stringify(CONTAINER_CONFIG, null, 2));

    Object.keys(categories).sort().forEach((category) => {
      const categoryContainer = document.createElement("div");
      categoryContainer.classList.add("category-container");

      const categoryButton = document.createElement("button");
      categoryButton.classList.add("category-button");
	  
      const containerList = document.createElement("div");
      containerList.classList.add("category-sites");
      containerList.id = `category-${category.replace(/\s+/g, "-")}`;
      containerList.style.display = "none";

      const enabledCount = categories[category].filter(container => localContainerSettings[container.name]?.enabled ?? container.enabledDefault).length;
      const disabledCount = categories[category].length - enabledCount;
      categoryButton.innerHTML = `
        <span class="category-name">${category}</span>
        <span class="category-counts">
          <span class="enabled-count" style="color: green;">${enabledCount}</span>
          /<span class="disabled-count" style="color: red;">${disabledCount}</span>
        </span>
        <span class="category-caret">^</span>
      `; 
      categoryButton.addEventListener("click", (event) => handleCategoryClick(event, categoryButton, containerList, ));

      categories[category].sort((a, b) => a.displayName.localeCompare(b.displayName)).forEach((container) => {
        const containerCard = document.createElement("div");
        const isEnabled = localContainerSettings[container.name]?.enabled ?? container.enabledDefault;
        containerCard.className = `container-card ${isEnabled ? "enabled" : "disabled"}`;
        containerCard.setAttribute("data-name", container.name);
        containerCard.addEventListener("click", (event) => handleContainerClick(event, containerCard, container));

        const containerName = document.createElement("span");
        containerName.textContent = container.displayName;
        containerCard.appendChild(containerName);

        const colorIndicator = document.createElement("div");
        colorIndicator.classList.add("color-indicator");
        colorIndicator.style.backgroundColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];

        if (!isEnabled) {
          colorIndicator.classList.add("hidden");
        }

        colorIndicator.addEventListener("click", async (e) => handleColorIndicatorClick(e, colorIndicator, container, containerCard));

        containerCard.appendChild(colorIndicator);
        containerList.appendChild(containerCard);
      });

      
      categoryContainer.appendChild(categoryButton);
      categoryContainer.appendChild(containerList);
      categoryDiv.appendChild(categoryContainer);

      updateCategoryCounts();
    });
  }

  function handleCategoryClick(event, categoryButton, containerList) {
    event.stopPropagation();
    const isExpanded = containerList.style.display === "block";
    containerList.style.display = isExpanded ? "none" : "block";
    categoryButton.classList.toggle("expanded", !isExpanded);
    categoryButton.querySelector(".category-caret").classList.toggle("rotated", !isExpanded);
  }

  async function handleContainerClick(event, containerCard, container) {
    const isNowEnabled = containerCard.classList.toggle("enabled");
    containerCard.classList.toggle("disabled", !isNowEnabled);
    await saveSettingsAndUpdateContainer(container.name, isNowEnabled);

    const colorIndicator = containerCard.querySelector(".color-indicator");
    if (colorIndicator) {
      if (isNowEnabled) {
        colorIndicator.classList.remove("hidden");
        colorIndicator.style.backgroundColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];
      } else {
        colorIndicator.classList.add("hidden");
      }
    }

    updateCategoryCounts();
  }

  async function handleColorIndicatorClick(e, colorIndicator, container, containerCard) {
    e.stopPropagation();
    const currentColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];
    const nextColor = CONTAINER_COLOR_OPTIONS[(CONTAINER_COLOR_OPTIONS.indexOf(currentColor) + 1) % CONTAINER_COLOR_OPTIONS.length];
    colorIndicator.style.backgroundColor = nextColor;
    await saveSettingsAndUpdateContainer(container.name, containerCard.classList.contains("enabled"), nextColor);
  }

  function updateCategoryCounts() {
    document.querySelectorAll(".category-container").forEach(category => {
      const categoryButton = category.querySelector(".category-button");
      const categoryName = categoryButton.querySelector(".category-name")?.textContent.trim();

      const containers = CONTAINER_CONFIG.filter(container => container.category === categoryName);
      const enabledCount = containers.filter(container => localContainerSettings[container.name]?.enabled ?? container.enabledDefault).length;
      const disabledCount = containers.length - enabledCount;

      const countsSpan = categoryButton.querySelector(".category-counts");
      countsSpan.innerHTML = `
        <span class="enabled-count" style="color: green;">${enabledCount}</span>
        /<span class="disabled-count" style="color: red;">${disabledCount}</span>
      `;
    });
  }

  document.getElementById("enableAll").addEventListener("click", async () => {
    await Promise.all(CONTAINER_CONFIG.map(container => saveSettingsAndUpdateContainer(container.name, true)));
    updateAllContainersUI(true);
  });

  document.getElementById("disableAll").addEventListener("click", async () => {
    await Promise.all(CONTAINER_CONFIG.map(container => saveSettingsAndUpdateContainer(container.name, false)));
    updateAllContainersUI(false);
  });

  function updateAllContainersUI(isEnabled) {
    CONTAINER_CONFIG.forEach(container => {
      const containerCard = document.querySelector(`.container-card[data-name="${container.name}"]`);
      if (containerCard) {
        containerCard.classList.toggle("enabled", isEnabled);
        containerCard.classList.toggle("disabled", !isEnabled);
        containerCard.querySelector(".color-indicator")?.classList.toggle("hidden", !isEnabled);
      }
    });
  }

  document.getElementById("purgeAll").addEventListener("click", async () => {
    for (let container of CONTAINER_CONFIG) {
      const allContainers = await browser.contextualIdentities.query({});
      const containerToDelete = allContainers.find(c => c.name === container.name);
      if (containerToDelete && containerToDelete.cookieStoreId) {
        await browser.contextualIdentities.remove(containerToDelete.cookieStoreId);
      }
    }
  });

  async function saveSettingsAndUpdateContainer(name, isEnabled, selectedColor) {
    const savedSettings = localContainerSettings[name] || {};

    if (isEnabled) {

      // Update local storage
	  localContainerSettings[name] = { enabled: true, color: selectedColor };

      // Update browser containers
      const allContainers = await browser.contextualIdentities.query({});
      const updatedContainer = allContainers.find(c => c.name === name);
      if (updatedContainer && updatedContainer.cookieStoreId) {
        await browser.contextualIdentities.update(updatedContainer.cookieStoreId, { color: selectedColor });
      }

    } else if (CONTAINER_CONFIG.find(c => c.name === name).enabledDefault) {

      // Update local storage
      // (Needs to be set to override enabledDefault)
      localContainerSettings[name] = { enabled: false, color: undefined };

    } else {
      delete localContainerSettings[name];
    }
	
	await browser.storage.local.set({ containerSettings: localContainerSettings });

    updateCategoryCounts();
  }
});