export function parseRabbitRouting(topic: string): { exchange: string; routingKey: string } {
  const separatorIndex = topic.indexOf(':');
  if (separatorIndex <= 0 || separatorIndex === topic.length - 1) {
    throw new Error(`Invalid Rabbit outbox topic: ${topic}`);
  }

  return {
    exchange: topic.slice(0, separatorIndex),
    routingKey: topic.slice(separatorIndex + 1),
  };
}
