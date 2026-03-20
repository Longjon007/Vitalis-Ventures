import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-forge-accent hover:bg-forge-accent-hover text-white',
  secondary: 'bg-forge-border hover:bg-forge-border/80 text-forge-text',
  ghost: 'bg-transparent hover:bg-white/5 text-forge-muted hover:text-forge-text',
  danger: 'bg-forge-danger/20 hover:bg-forge-danger/30 text-forge-danger',
};

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
