import * as React from "react";

function SvgComponent(props) {
  return (
    <svg viewBox="0 0 100 100">
      {props.title && <title>{props.title}</title>}
      <path d="M0 50l25 25V25zM100 50L75 75V25z" />
      <path d="M45 5H55V25H45z" />
      <path d="M45 28.3333333H55V48.3333333H45z" />
      <path d="M45 51.6666666H55V71.6666666H45z" />
      <path d="M45 75H55V95H45z" />
    </svg>
  );
}

export default SvgComponent;
