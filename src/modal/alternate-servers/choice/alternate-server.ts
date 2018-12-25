export class AlternateServer {
  url:string;
  name:string;
  description:string;
  replacementUrl:string;
  replacementExplanation:string;

  static fromServerData(serverData):AlternateServer {
    const server = new AlternateServer();
    server.url = serverData.url;
    server.name = serverData.name;
    server.description = serverData.description;
    server.replacementUrl = serverData.replacement_url;
    server.replacementExplanation = serverData.replacement_explanation;
    return server;
  }
}
