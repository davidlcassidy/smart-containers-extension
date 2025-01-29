document.addEventListener("DOMContentLoaded", async () => {
  let CONTAINER_CONFIG = {};
  const CONTAINER_COLOR_OPTIONS = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];
  
  let data = await browser.storage.local.get("containerSettings");
  let localContainerSettings = data.containerSettings || {};

  try {
    const response = await fetch(browser.runtime.getURL("configs/containers.json"));
    const json = await response.json();
    CONTAINER_CONFIG = json;
    generateSettingsForm();
  } catch (error) {
    console.error("Error loading JSON:", error);
  }

  function generateSettingsForm() {
    const form = document.getElementById("dashboardForm");

    CONTAINER_CONFIG.containers.forEach((container) => {
      const containerBox = document.createElement("div");
      containerBox.className = "container-box";
      
	  const isContainerEnabled = localContainerSettings[container.name]?.enabled || container.enabledDefault
      containerBox.dataset.enabled = isContainerEnabled ? "true" : "false";
      containerBox.dataset.color = CONTAINER_COLOR_OPTIONS[0];
      containerBox.style.backgroundColor = isContainerEnabled ? "#d4f8d4" : "#fde2e2";

      // Toggle enable/disable state on click
      containerBox.addEventListener("click", async (e) => {
        if (!e.target.classList.contains("color-circle")) {
          containerBox.dataset.enabled = containerBox.dataset.enabled === "true" ? "false" : "true";
          containerBox.style.backgroundColor = containerBox.dataset.enabled === "true" ? "#d4f8d4" : "#fde2e2";
          await saveSettings();
        }
      });

      // Container name
      const containerName = document.createElement("span");
      containerName.textContent = container.displayName;
      containerName.style.flex = "1";
      containerBox.appendChild(containerName);

      // Color picker
      const colorPicker = document.createElement("div");
      colorPicker.className = "color-picker";
      CONTAINER_COLOR_OPTIONS.forEach((color) => {
        const colorCircle = document.createElement("div");
        colorCircle.className = "color-circle";
        colorCircle.style.backgroundColor = color;
        colorCircle.dataset.color = color;

        // Select color on click
        colorCircle.addEventListener("click", async (e) => {
          e.stopPropagation();
          containerBox.dataset.color = color;
          await saveSettings();
        });

        colorPicker.appendChild(colorCircle);
      });
      containerBox.appendChild(colorPicker);
      form.appendChild(containerBox);
    });

    // Load saved settings from storage
    browser.storage.local.get("containerSettings").then((data) => {
      if (data.containerSettings) {
        CONTAINER_CONFIG.containers.forEach((container) => {
          const containerBox = document.querySelector(`.container-box:nth-child(${CONTAINER_CONFIG.containers.indexOf(container) + 1})`);
          if (containerBox) {
            const savedSettings = data.containerSettings[container.name];
            containerBox.dataset.enabled = savedSettings?.enabled ? "true" : "false";
            containerBox.dataset.color = savedSettings?.color || CONTAINER_COLOR_OPTIONS[0];
            containerBox.style.backgroundColor = savedSettings?.enabled ? "#d4f8d4" : "#fde2e2";
          }
        });
      }
    });
  }

  async function saveSettings() {
    const containerBoxes = document.querySelectorAll(".container-box");
    let containersToUpdate = [];
    let localSettingsChanged = false;

    for (const [index, box] of containerBoxes.entries()) {
      const name = CONTAINER_CONFIG.containers[index].name;
      const enabled = box.dataset.enabled === "true";
      const color = box.dataset.color || CONTAINER_COLOR_OPTIONS[0];
      const savedSettings = localContainerSettings[name] || {};

      const enabledStateChanged = savedSettings.enabled !== enabled;
      const containerColorChanged = savedSettings.color !== color;

      if (enabledStateChanged || containerColorChanged) {
        localContainerSettings[name] = { enabled, color };
        containersToUpdate.push({ name, enabled, color });
        localSettingsChanged = true;
      }
    }

    if (localSettingsChanged) {
      await browser.storage.local.set({ containerSettings: localContainerSettings });
    }

    for (const { name, color } of containersToUpdate) {
      const containers = await browser.contextualIdentities.query({});
      const container = containers.find((c) => c.name === name);
      const hasContainerColorBeenChanged = container && container.color !== color;
      if (hasContainerColorBeenChanged) {
        await browser.contextualIdentities.update(container.cookieStoreId, { color: color });
      }
    }
  }

});
