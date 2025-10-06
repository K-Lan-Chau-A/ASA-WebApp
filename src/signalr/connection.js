import * as signalR from "@microsoft/signalr";

export const hubConnection = new signalR.HubConnectionBuilder()
  .withUrl(`${import.meta.env.VITE_API_URL}/notificationHub`, {
  withCredentials: true,
})
  .withAutomaticReconnect()
  .build();
