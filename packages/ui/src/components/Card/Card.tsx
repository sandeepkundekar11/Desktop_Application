import React, { FC, HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly elevated?: boolean;
}

export const Card: FC<CardProps> = ({
  header,
  footer,
  elevated = false,
  className = '',
  children,
  ...rest
}) => {
  const elevatedClass = elevated ? 'ui-card--elevated' : '';
  const cardClassName = `ui-card ${elevatedClass} ${className}`.trim();

  return (
    <article className={cardClassName} {...rest}>
      {header && <header className="ui-card__header">{header}</header>}
      <div className="ui-card__content">{children}</div>
      {footer && <footer className="ui-card__footer">{footer}</footer>}
    </article>
  );
};
