import React, { FC, ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly fullWidth?: boolean;
}

export const Button: FC<ButtonProps> = ({
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const variantClass = variant === 'secondary' ? 'ui-button--secondary' : 'ui-button--primary';
  const widthClass = fullWidth ? 'ui-button--full-width' : '';
  const combinedClassName = `ui-button ${variantClass} ${widthClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={combinedClassName}
      disabled={disabled}
      aria-disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};
