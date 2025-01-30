let CONTAINER_CONFIG = {};
const DEFAULT_CONTAINER_IDS = [null, "firefox-default"];

fetch(browser.runtime.getURL("configs/containers.json"))
  .then((response) => response.json())
  .then((jsonData) => {
    try {
      CONTAINER_CONFIG = jsonData;
    } catch (error) {
      console.error("Error parsing JSON:", error);
    }
  })
  .catch((err) => console.error("Error loading JSON:", err));

async function findOrCreateContainer(name, color, icon) {
  const containers = await browser.contextualIdentities.query({});
  const existingContainer = containers.find(c => c.name === name);

  if (existingContainer) {
    return existingContainer.cookieStoreId;
  }

  const newContainer = await browser.contextualIdentities.create({
      name,
      color,
      icon,
    });

    return newContainer.cookieStoreId;
}

async function moveTabToContainer(details, containerId) {
  await browser.tabs.create({
    url: details.url,
    cookieStoreId: containerId,
  });
  await browser.tabs.remove(details.tabId);
}

function isMatchingDomain(url, pattern) {
  const multiLevelTLDs = ["co.in", "co.jp", "co.mx", "co.nz", "co.tr", "co.uk", "com.au", "com.br", "com.sa"];
  const currentUrl = new URL(url);
  let domain = currentUrl.hostname;

  const parts = domain.split(".");
  
  let baseDomain;
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join(".");
    if (multiLevelTLDs.includes(lastTwo)) {
      baseDomain = parts.slice(-3).join(".");
    } else {
      baseDomain = parts.slice(-2).join(".");
    }
  } else {
    baseDomain = domain;
  }

  if (pattern.endsWith(".*")) {
    return baseDomain.startsWith(pattern.slice(0, -2) + ".");
  }

  return baseDomain === pattern;
}

browser.webRequest.onBeforeRequest.addListener(
  async (details) => {
    let shouldHaveContainer = false;

    const tab = await browser.tabs.get(details.tabId);

    const localStorageData = await browser.storage.local.get("containerSettings");
    const localContainerSettings = localStorageData.containerSettings || {};

    for (const container of CONTAINER_CONFIG.containers) {
      const { name, enabledDefault, domains } = container;

      const localContainerSetting = localContainerSettings[name] || {};

	  const isContainerEnabled = localContainerSetting.enabled ?? container.enabledDefault;
      if (!isContainerEnabled) {
        continue;
      }

      const doesDomainMatchContainer = domains.some((d) => isMatchingDomain(details.url, d));
      if (doesDomainMatchContainer) {
		shouldHaveContainer = true;

		const containerId = await findOrCreateContainer(name, localContainerSetting.color || "red", "fence");
		const isAlreadyInCorrectContainer = tab.cookieStoreId === containerId
        if (isAlreadyInCorrectContainer) {
          break;
        }

        await moveTabToContainer(details, containerId)
        break;
      }
    }
	
	const isAlreadyInContainer = !DEFAULT_CONTAINER_IDS.includes(tab.cookieStoreId)
	if (!shouldHaveContainer && isAlreadyInContainer) {
	  await moveTabToContainer (details, null)
    }
	
    return {};
  },
  {
    urls: ["<all_urls>"],
    types: ["main_frame"],
  },
  ["blocking"]
);
