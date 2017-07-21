export class AlternateServer {
  url:string;
  name:string;
  description:string;

  static fromServerData(serverData):AlternateServer {
    const server = new AlternateServer();
    server.url = serverData.url;
    server.name = serverData.name;
    server.description = serverData.description;
    return server;
  }
}
