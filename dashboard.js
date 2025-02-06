document.addEventListener("DOMContentLoaded", async () => {
  let CONTAINER_CONFIG = {};
  const CONTAINER_COLOR_OPTIONS = ["red", "orange", "yellow", "green", "turquoise", "blue", "purple", "pink"];

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
    const containerDiv = document.getElementById("containers");
    containerDiv.innerHTML = "";

    CONTAINER_CONFIG.sort((a, b) => a.displayName.localeCompare(b.displayName)).forEach((container) => {
      const containerCard = document.createElement("div");
      containerCard.className = `container-card ${localContainerSettings[container.name]?.enabled ? "enabled" : "disabled"}`;
      containerCard.setAttribute("data-name", container.name);
      containerCard.addEventListener("click", (event) => handleContainerClick(event, containerCard, container));

      const containerName = document.createElement("span");
      containerName.textContent = container.displayName;
      containerCard.appendChild(containerName);

      const colorIndicator = document.createElement("div");
      colorIndicator.classList.add("color-indicator");
      colorIndicator.style.backgroundColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];

      if (!localContainerSettings[container.name]?.enabled) {
        colorIndicator.classList.add("hidden");
      }

      colorIndicator.addEventListener("click", async (e) => handleColorIndicatorClick(e, colorIndicator, container, containerCard));

      containerCard.appendChild(colorIndicator);
      containerDiv.appendChild(containerCard);
    });
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
  }

  async function handleColorIndicatorClick(e, colorIndicator, container, containerCard) {
    e.stopPropagation();
    const currentColor = localContainerSettings[container.name]?.color || CONTAINER_COLOR_OPTIONS[0];
    const nextColor = CONTAINER_COLOR_OPTIONS[(CONTAINER_COLOR_OPTIONS.indexOf(currentColor) + 1) % CONTAINER_COLOR_OPTIONS.length];
    colorIndicator.style.backgroundColor = nextColor;
    await saveSettingsAndUpdateContainer(container.name, containerCard.classList.contains("enabled"), nextColor);
  }

  document.getElementById("purgeAll").addEventListener("click", async () => {
    const purgeButton = document.getElementById("purgeAll");

    purgeButton.disabled = true;
    purgeButton.textContent = "Purging...";
    purgeButton.style.background = "#ffc107";

    for (let container of CONTAINER_CONFIG) {
      const allContainers = await browser.contextualIdentities.query({});
      const containerToDelete = allContainers.find(c => c.name === container.name);
      if (containerToDelete && containerToDelete.cookieStoreId) {
        await browser.contextualIdentities.remove(containerToDelete.cookieStoreId);
      }
    }

    purgeButton.textContent = "Purge Complete!";
    purgeButton.style.background = "#909ff5";

    setTimeout(() => {
      purgeButton.textContent = "Purge Containers";
      purgeButton.style.background = "";
      purgeButton.disabled = false;
    }, 5000);
  });


  async function saveSettingsAndUpdateContainer(name, isEnabled, selectedColor) {
    const savedSettings = localContainerSettings[name] || {};

    if (isEnabled) {
      localContainerSettings[name] = { enabled: true, color: selectedColor };

      const allContainers = await browser.contextualIdentities.query({});
      const updatedContainer = allContainers.find(c => c.name === name);
      if (updatedContainer && updatedContainer.cookieStoreId) {
        await browser.contextualIdentities.update(updatedContainer.cookieStoreId, { color: selectedColor });
      }
    } else {
      delete localContainerSettings[name];
    }

    await browser.storage.local.set({ containerSettings: localContainerSettings });
  }
});
