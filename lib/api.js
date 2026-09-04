import axios from "axios";

const api = axios.create({
  baseURL: "https://api.localpro1.net/api",
  withCredentials: true,
});

export default api;