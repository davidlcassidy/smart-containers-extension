let CONTAINER_CONFIG = {};
const DEFAULT_CONTAINER_IDS = [null, "firefox-default"];
const MULTI_LEVEL_TLDS = [
  "ac.id", "ac.in", "ac.jp", "ac.kr", "ac.nz", "ac.uk",
  "co.id", "co.il", "co.in", "co.jp", "co.ke", "co.kr", "co.ma", "co.mx",
  "co.nz", "co.th", "co.tr", "co.ug", "co.uk", "co.ve", "co.za", "co.zw",
  "com.ar", "com.au", "com.bd", "com.bo", "com.br", "com.cn", "com.co",
  "com.do", "com.ec", "com.eg", "com.gt", "com.hk", "com.hn", "com.lb",
  "com.my", "com.mx", "com.ng", "com.ni", "com.pe", "com.ph", "com.pk",
  "com.py", "com.ru", "com.sa", "com.sg", "com.sv", "com.tr", "com.tw",
  "com.ua", "com.vn",
  "net.ar", "net.au", "net.br", "net.cn", "net.co", "net.in", "net.mx",
  "net.nz", "net.pe", "net.ph", "net.pk", "net.uk", "net.ve", "net.za",
  "org.ar", "org.au", "org.br", "org.co", "org.in", "org.mx", "org.nz",
  "org.pe", "org.ph", "org.pk", "org.uk", "org.ve", "org.za"
];


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
  const currentUrl = new URL(url);
  const domain = currentUrl.hostname;

  const parts = domain.split(".");
  
  let baseDomain;
  if (parts.length > 2) {
    const lastTwo = parts.slice(-2).join(".");
    if (MULTI_LEVEL_TLDS.includes(lastTwo)) {
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
    let shouldBeInContainer = false;

    const tab = await browser.tabs.get(details.tabId);

    const localStorageData = await browser.storage.local.get("containerSettings");
    const localContainerSettings = localStorageData.containerSettings || {};

    for (const container of CONTAINER_CONFIG) {
      const { name, domains } = container;

      const localContainerSetting = localContainerSettings[name] || {};

      if (!localContainerSetting.enabled) {
        continue;
      }

      const doesDomainMatchContainer = domains.some((configDomain) => isMatchingDomain(details.url, configDomain));
      if (doesDomainMatchContainer) {
		shouldBeInContainer = true;

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
	if (!shouldBeInContainer && isAlreadyInContainer) {
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
