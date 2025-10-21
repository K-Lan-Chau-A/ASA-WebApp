
// === TOKEN ===
export async function getAuthToken() {
  return localStorage.getItem("accessToken") || "";
}

export async function setAuthToken(token) {
  localStorage.setItem("accessToken", token);
}

export async function clearAuthToken() {
  localStorage.removeItem("accessToken");
}

// === SHOP INFO ===
export async function getShopId() {
  const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
  return userProfile?.shopId || 0;
}

export async function setShopInfo(shopData) {
  localStorage.setItem("userProfile", JSON.stringify(shopData || {}));
}

export async function clearShopInfo() {
  localStorage.removeItem("userProfile");
}

// === CLEAR ALL ===
export async function clearAllAuthData() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("userProfile");
}
