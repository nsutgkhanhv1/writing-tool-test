import React from "react";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="fixed inset-0 bg-black flex justify-center items-start overflow-hidden touch-manipulation motion-preset-blur-right-sm motion-duration-200 -pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-lg bg-black h-full overflow-hidden overscroll-none flex flex-col motion-preset-blur-right motion-duration-500">
        {children}
      </div>
    </div>
  );
};

export default Layout;
