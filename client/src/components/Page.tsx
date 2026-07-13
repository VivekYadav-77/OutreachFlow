import React from "react";

export function Page({
  title,
  actions,
  children,
  titleIcon
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  titleIcon?: React.ReactNode;
}) {
  return (
    <>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{title}</h1>
          {titleIcon}
        </div>
        <div>{actions}</div>
      </header>
      {children}
    </>
  );
}
