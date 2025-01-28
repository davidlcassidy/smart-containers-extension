document.addEventListener("DOMContentLoaded", async () => {
  let CONTAINER_CONFIG = {};
  const availableColors = ["red", "orange", "yellow", "green", "blue", "purple", "pink"];

  try {
    const response = await fetch(browser.runtime.getURL("containers.json"));
    const json = await response.json();
    CONTAINER_CONFIG = json;
    generateSettingsForm(CONTAINER_CONFIG.containers);
  } catch (error) {
    console.error("Error loading JSON:", error);
  }

  function generateSettingsForm(containers) {
    const form = document.getElementById("dashboardForm");

    containers.forEach((container) => {
      const containerBox = document.createElement("div");
      containerBox.className = "container-box";
      containerBox.dataset.enabled = "true";
      containerBox.dataset.color = container.defaultColor;
      containerBox.style.backgroundColor = "#d4f8d4";

      // Toggle enable/disable state on click
      containerBox.addEventListener("click", async (e) => {
        if (!e.target.classList.contains("color-circle")) {
          const isEnabled = containerBox.dataset.enabled === "true";
          containerBox.dataset.enabled = isEnabled ? "false" : "true";
          containerBox.style.backgroundColor = isEnabled ? "#fde2e2" : "#d4f8d4";
          await saveSettings();
        }
      });

      // Container name
      const containerName = document.createElement("span");
      containerName.textContent = container.name;
      containerName.style.flex = "1";
      containerBox.appendChild(containerName);

      // Color picker
      const colorPicker = document.createElement("div");
      colorPicker.className = "color-picker";
      availableColors.forEach((color) => {
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
        containers.forEach((container) => {
          const containerBox = document.querySelector(`.container-box:nth-child(${containers.indexOf(container) + 1})`);
          if (containerBox) {
            const savedSettings = data.containerSettings[container.name];
            containerBox.dataset.enabled = savedSettings?.enabled ? "true" : "false";
            containerBox.dataset.color = savedSettings?.color || container.defaultColor;
            containerBox.style.backgroundColor = savedSettings?.enabled ? "#d4f8d4" : "#fde2e2";
          }
        });
      }
    });
  }

  async function saveSettings() {
    const containerSettings = {};
    const containerBoxes = document.querySelectorAll(".container-box");
    let containersToUpdate = [];
    let localSettingsChanged = false;

    for (const [index, box] of containerBoxes.entries()) {
      const name = CONTAINER_CONFIG.containers[index].name;
      const enabled = box.dataset.enabled === "true";
      const color = box.dataset.color || availableColors[0];
      const savedSettings = containerSettings[name] || {};

	  const enabledStateChanged = savedSettings.enabled !== enabled;
	  const containerColorChanged = savedSettings.color !== color;
      if (enabledStateChanged || containerColorChanged) {
        containerSettings[name] = { enabled, color };
        containersToUpdate.push({ name, enabled, color });
        localSettingsChanged = true;
      }
    }

    if (localSettingsChanged) {
      await browser.storage.local.set({ containerSettings });
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
