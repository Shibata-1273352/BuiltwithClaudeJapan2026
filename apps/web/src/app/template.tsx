/**
 * Every screen enters the same way (a change of state, CLAUDE.md design 7): a short rise out of the
 * night, so moving from the landing to the stage, the note or the print reads as one place. CSS only;
 * nothing under reduced motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter flex flex-1 flex-col">{children}</div>;
}
