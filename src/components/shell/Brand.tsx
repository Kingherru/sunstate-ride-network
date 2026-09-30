// Temporary brand mark. "NEMT" is a separate span so it can be styled later.
export function Brand() {
  return (
    <span className="font-bold tracking-wide">
      <span data-brand="my-florida">MY FLORIDA</span>{" "}
      <span data-brand="nemt">NEMT</span>
    </span>
  );
}
