"use client";

import { useEffect, useState } from "react";
import { ToastContainer } from "react-toastify";

export function ToastRoot() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <ToastContainer />;
}
