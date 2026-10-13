/**
 * Renders a caller-supplied trigger that opens a billing modal, or the modal's
 * own default button (children) when no trigger is given.
 */
export function ModalTrigger({
  trigger,
  onOpen,
  children,
}: {
  trigger?: React.ReactNode
  onOpen: () => void
  children: React.ReactNode
}) {
  if (!trigger) return <>{children}</>
  return (
    <span onClick={onOpen} className="inline-flex cursor-pointer">
      {trigger}
    </span>
  )
}
