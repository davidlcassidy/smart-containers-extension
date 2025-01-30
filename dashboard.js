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
    const enabledContainerDiv = document.getElementById("enabledWebsites");
    const categoryDiv = document.getElementById("categories");
    
    const categories = {};

    // Loop through all containers to group them into categories and move enabled websites into separate div
    CONTAINER_CONFIG.containers.forEach((container) => {
      const isContainerEnabled = localContainerSettings[container.name]?.enabled ?? container.enabledDefault;

      if (!categories[container.category]) {
        categories[container.category] = [];
      }

      if (isContainerEnabled) {
        const containerBox = createContainerBox(container, isContainerEnabled);
        enabledContainerDiv.appendChild(containerBox);
      } else {
        categories[container.category].push(container);
      }
    });

    // Create category buttons and containers
    Object.keys(categories).forEach((category) => {
      const categoryButton = document.createElement("button");
      categoryButton.textContent = category;
      categoryButton.classList.add("category-button");
      categoryButton.addEventListener("click", () => toggleCategory(category));

      const siteList = document.createElement("div");
      siteList.classList.add("category-sites");
      siteList.id = `category-${category.replace(/\s+/g, "-")}`;

      categories[category].forEach((container) => {
        const containerBox = createContainerBox(container, localContainerSettings[container.name]?.enabled || false);
        siteList.appendChild(containerBox);
      });

      categoryDiv.appendChild(categoryButton);
      categoryDiv.appendChild(siteList);
    });
  }

  function createContainerBox(container, isEnabled) {
    const containerBox = document.createElement("div");
    containerBox.className = `container-box ${isEnabled ? "enabled" : "disabled"}`;
    
    containerBox.addEventListener("click", async () => {
      const isNowEnabled = containerBox.classList.toggle("enabled");
      containerBox.classList.toggle("disabled", !isNowEnabled);
      await saveSettings(container.name, isNowEnabled);
      updateUI(container, isNowEnabled);
    });

    const containerName = document.createElement("span");
    containerName.textContent = container.displayName;
    containerName.style.flex = "1";
    containerBox.appendChild(containerName);

    if (isEnabled) {
      const colorCircle = document.createElement("div");
      colorCircle.classList.add("color-circle");
      colorCircle.style.backgroundColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];

      colorCircle.addEventListener("click", async (e) => {
        e.stopPropagation();
        let currentColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];
        const currentIndex = CONTAINER_COLOR_OPTIONS.indexOf(currentColor);
        const nextColor = CONTAINER_COLOR_OPTIONS[(currentIndex + 1) % CONTAINER_COLOR_OPTIONS.length];
        
        await saveSettings(container.name, isEnabled, nextColor);
        updateUI(container, isEnabled);
      });

      containerBox.appendChild(colorCircle);
    }

    return containerBox;
  }

  function toggleCategory(category) {
    const siteList = document.getElementById(`category-${category.replace(/\s+/g, "-")}`);
    siteList.classList.toggle("category-expanded");
  }

  async function updateUI(inputContainer, isNowEnabled) {

    // Rebuild the "Enabled Websites" section
    const enabledContainerDiv = document.getElementById("enabledWebsites");
    enabledContainerDiv.innerHTML = "";
    CONTAINER_CONFIG.containers.forEach((container) => {
      const isContainerEnabled = localContainerSettings[container.name]?.enabled ?? container.enabledDefault;
      if (isContainerEnabled) {
        const containerBox = createContainerBox(container, isContainerEnabled);
        enabledContainerDiv.appendChild(containerBox);
      }
    });

    // Rebuild the category section for the given category
    const categoryDiv = document.getElementById("categories");
    const siteList = document.getElementById(`category-${inputContainer.category.replace(/\s+/g, "-")}`);
    if (siteList) {
      siteList.innerHTML = "";
      CONTAINER_CONFIG.containers.forEach((container) => {
        const isContainerEnabled = localContainerSettings[container.name]?.enabled ?? container.enabledDefault;
        if (container.category === inputContainer.category && !isContainerEnabled) {
          const containerBox = createContainerBox(container, isContainerEnabled);
          siteList.appendChild(containerBox);
        }
      });
    }
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
  }
});
