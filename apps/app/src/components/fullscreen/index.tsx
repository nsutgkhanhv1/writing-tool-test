import { useEffect } from "react";
import { useVisualViewport } from "./useVisualViewport.js";

export const FullScreenContainer = ({
  className,
  style,
  disablePaddingBottom,
  ...props
}: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
  disablePaddingBottom?: boolean;
}) => {
  const viewport = useVisualViewport();
  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({
        top: 0,
      });
    }, 0);
  }, [viewport]);
  useEffect(() => {
    const handleScroll = () => {
      window.scrollTo(0, 0);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
  return (
    <div
      {...props}
      className={[className, "overscroll-contain fixed top-0 left-0"].join(" ").trim()}
      style={{
        ...style,
        width: viewport.width,
        height: viewport.height,
        overflow: "hidden",
        padding:
          disablePaddingBottom || viewport.isKeyboardOpen
            ? "env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)"
            : "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }}
    />
  );
};
