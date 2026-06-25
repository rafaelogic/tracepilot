export function SegmentedButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className={active ? "segmented active" : "segmented"} type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
