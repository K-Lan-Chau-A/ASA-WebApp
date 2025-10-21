
export async function getAuthToken() {
  return localStorage.getItem("accessToken") || "";
}

export async function getShopId() {
  const userProfile = JSON.parse(localStorage.getItem("userProfile") || "{}");
  return userProfile?.shopId || 0;
}
