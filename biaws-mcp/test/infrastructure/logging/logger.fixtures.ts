function captureStream() {
  const lines: string[] = [];
  return {
    lines,
    stream: { write: (line: string) => lines.push(line) },
  };
}
export { captureStream };
