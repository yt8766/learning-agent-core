import type { ReactNode, SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function IconSvg({ children, icon, size = 16, ...props }: IconProps & { children: ReactNode; icon: string }) {
  return (
    <svg
      data-chatbot-icon={icon}
      height={size}
      strokeLinejoin="round"
      style={{ color: 'currentcolor', ...props.style }}
      viewBox="0 0 16 16"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function MessageSquareIcon(props: IconProps) {
  return (
    <IconSvg icon="message-square" {...props}>
      <path
        d="M2.5 3.5C2.5 2.94772 2.94772 2.5 3.5 2.5H12.5C13.0523 2.5 13.5 2.94772 13.5 3.5V9.5C13.5 10.0523 13.0523 10.5 12.5 10.5H7.3L4.2 13V10.5H3.5C2.94772 10.5 2.5 10.0523 2.5 9.5V3.5Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function PanelLeftIcon(props: IconProps) {
  return (
    <IconSvg icon="panel-left" {...props}>
      <path d="M6 2.5V13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path
        d="M2.5 4C2.5 3.17157 3.17157 2.5 4 2.5H12C12.8284 2.5 13.5 3.17157 13.5 4V12C13.5 12.8284 12.8284 13.5 12 13.5H4C3.17157 13.5 2.5 12.8284 2.5 12V4Z"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function PenSquareIcon(props: IconProps) {
  return (
    <IconSvg icon="pen-square" {...props}>
      <path
        d="M9.8 2.7L13.3 6.2M3.5 12.5L5 8.25L10.75 2.5C11.3 1.95 12.2 1.95 12.75 2.5L13.5 3.25C14.05 3.8 14.05 4.7 13.5 5.25L7.75 11L3.5 12.5Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M7 3.5H3.75C3.05964 3.5 2.5 4.05964 2.5 4.75V12.25C2.5 12.9404 3.05964 13.5 3.75 13.5H11.25C11.9404 13.5 12.5 12.9404 12.5 12.25V9"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function TrashIcon({ size = 16, ...props }: IconProps) {
  return (
    <IconSvg icon="trash" size={size} {...props}>
      <path
        clipRule="evenodd"
        d="M6.75 2.75C6.75 2.05964 7.30964 1.5 8 1.5C8.69036 1.5 9.25 2.05964 9.25 2.75V3H6.75V2.75ZM5.25 3V2.75C5.25 1.23122 6.48122 0 8 0C9.51878 0 10.75 1.23122 10.75 2.75V3H15V4.5H13.8846L13.1776 13.6917C13.0774 14.9942 11.9913 16 10.6849 16H5.31508C4.00874 16 2.92263 14.9942 2.82244 13.6917L2.11538 4.5H1V3H5.25ZM4.31802 13.5767L3.61982 4.5H12.3802L11.682 13.5767C11.6419 14.0977 11.2075 14.5 10.6849 14.5H5.31508C4.79254 14.5 4.3581 14.0977 4.31802 13.5767Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </IconSvg>
  );
}

export function MoreHorizontalIcon(props: IconProps) {
  return (
    <IconSvg icon="more-horizontal" {...props}>
      <path
        d="M4 8C4 8.82843 3.32843 9.5 2.5 9.5C1.67157 9.5 1 8.82843 1 8C1 7.17157 1.67157 6.5 2.5 6.5C3.32843 6.5 4 7.17157 4 8ZM9.5 8C9.5 8.82843 8.82843 9.5 8 9.5C7.17157 9.5 6.5 8.82843 6.5 8C6.5 7.17157 7.17157 6.5 8 6.5C8.82843 6.5 9.5 7.17157 9.5 8ZM15 8C15 8.82843 14.3284 9.5 13.5 9.5C12.6716 9.5 12 8.82843 12 8C12 7.17157 12.6716 6.5 13.5 6.5C14.3284 6.5 15 7.17157 15 8Z"
        fill="currentColor"
      />
    </IconSvg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <IconSvg icon="chevron-up" {...props}>
      <path d="M4 10L8 6L12 10" fill="transparent" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </IconSvg>
  );
}

export function ArrowUpIcon({ size = 16, ...props }: IconProps) {
  return (
    <IconSvg icon="arrow-up" size={size} {...props}>
      <path
        clipRule="evenodd"
        d="M8.70711 1.39644C8.31659 1.00592 7.68342 1.00592 7.2929 1.39644L2.21968 6.46966L1.68935 6.99999L2.75001 8.06065L3.28034 7.53032L7.25001 3.56065V15H8.75001V3.56065L12.7197 7.53032L13.25 8.06065L14.3107 6.99999L13.7803 6.46966L8.70711 1.39644Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </IconSvg>
  );
}

export function StopIcon({ size = 16, ...props }: IconProps) {
  return (
    <IconSvg icon="stop" size={size} {...props}>
      <path clipRule="evenodd" d="M3 3H13V13H3V3Z" fill="currentColor" fillRule="evenodd" />
    </IconSvg>
  );
}

export function PaperclipIcon({ size = 16, ...props }: IconProps) {
  return (
    <IconSvg icon="paperclip" size={size} {...props}>
      <path
        clipRule="evenodd"
        d="M10.8591 1.70735C10.3257 1.70735 9.81417 1.91925 9.437 2.29643L3.19455 8.53886C2.56246 9.17095 2.20735 10.0282 2.20735 10.9222C2.20735 11.8161 2.56246 12.6734 3.19455 13.3055C3.82665 13.9376 4.68395 14.2927 5.57786 14.2927C6.47178 14.2927 7.32908 13.9376 7.96117 13.3055L14.7038 6.56287L15.7041 7.56321L8.96151 14.3058C8.06411 15.2032 6.84698 15.7074 5.57786 15.7074C4.30875 15.7074 3.09162 15.2032 2.19422 14.3058C1.29682 13.4084 0.792664 12.1913 0.792664 10.9222C0.792664 9.65305 1.29682 8.43592 2.19422 7.53852L8.43666 1.29609C9.07914 0.653606 9.95054 0.292664 10.8591 0.292664C11.7678 0.292664 12.6392 0.653606 13.2816 1.29609C13.9241 1.93857 14.2851 2.80997 14.2851 3.71857C14.2851 4.62718 13.9241 5.49858 13.2816 6.14106L7.03213 12.3838C6.64459 12.7712 6.11905 12.9888 5.57107 12.9888C5.02297 12.9888 4.49731 12.7711 4.10974 12.3835C3.72217 11.9959 3.50444 11.4703 3.50444 10.9222C3.50444 10.3741 3.72217 9.8484 4.10974 9.46084L9.877 3.70039L10.877 4.70131L5.11008 10.4612C4.98779 10.5835 4.91913 10.7493 4.91913 10.9222C4.91913 11.0951 4.98782 11.2609 5.11008 11.3832C5.23234 11.5054 5.39817 11.5741 5.57107 11.5741C5.74398 11.5741 5.9098 11.5054 6.03206 11.3832L12.2816 5.14045C12.6586 4.7633 12.8704 4.25185 12.8704 3.71857C12.8704 3.18516 12.6585 2.6736 12.2813 2.29643C11.9041 1.91925 11.3926 1.70735 10.8591 1.70735Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </IconSvg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconSvg icon="search" {...props}>
      <path
        d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5ZM11 11L14.5 14.5"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function ToolIcon(props: IconProps) {
  return (
    <IconSvg icon="tool" {...props}>
      <path
        d="M14.7 3.3L12.2 5.8L10.2 3.8L12.7 1.3C11.4 0.9 9.9 1.2 8.9 2.2C7.7 3.4 7.4 5.2 8.1 6.7L2.2 12.6C1.6 13.2 1.6 14.1 2.2 14.7C2.8 15.3 3.7 15.3 4.3 14.7L10.2 8.8C11.7 9.5 13.5 9.2 14.7 8C15.8 6.9 16.1 4.6 14.7 3.3Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconSvg icon="eye" {...props}>
      <path
        clipRule="evenodd"
        d="M4.02168 4.76932C6.11619 2.33698 9.88374 2.33698 11.9783 4.76932L14.7602 7.99999L11.9783 11.2307C9.88374 13.663 6.1162 13.663 4.02168 11.2307L1.23971 7.99999L4.02168 4.76932ZM13.1149 3.79054C10.422 0.663244 5.57797 0.663247 2.88503 3.79054L-0.318359 7.5106V8.48938L2.88503 12.2094C5.57797 15.3367 10.422 15.3367 13.1149 12.2094L16.3183 8.48938V7.5106L13.1149 3.79054ZM6.49997 7.99999C6.49997 7.17157 7.17154 6.49999 7.99997 6.49999C8.82839 6.49999 9.49997 7.17157 9.49997 7.99999C9.49997 8.82842 8.82839 9.49999 7.99997 9.49999C7.17154 9.49999 6.49997 8.82842 6.49997 7.99999ZM7.99997 4.99999C6.34311 4.99999 4.99997 6.34314 4.99997 7.99999C4.99997 9.65685 6.34311 11 7.99997 11C9.65682 11 11 9.65685 11 7.99999C11 6.34314 9.65682 4.99999 7.99997 4.99999Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </IconSvg>
  );
}

export function BrainIcon(props: IconProps) {
  return (
    <IconSvg icon="brain" {...props}>
      <path
        d="M6 2C4.9 2 4 2.9 4 4C3.1 4.2 2.5 5 2.5 6C2.5 6.7 2.9 7.3 3.4 7.7C2.9 8.1 2.5 8.7 2.5 9.5C2.5 10.6 3.4 11.5 4.5 11.5H6.5V2H6ZM10 2C11.1 2 12 2.9 12 4C12.9 4.2 13.5 5 13.5 6C13.5 6.7 13.1 7.3 12.6 7.7C13.1 8.1 13.5 8.7 13.5 9.5C13.5 10.6 12.6 11.5 11.5 11.5H9.5V2H10ZM6.5 5H5.5M6.5 8H5.25M9.5 5H10.5M9.5 8H10.75"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </IconSvg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconSvg icon="check" {...props}>
      <path
        d="M3 8.4L6.4 11.5L13 4.5"
        fill="transparent"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </IconSvg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconSvg icon="chevron-down" {...props}>
      <path d="M4 6L8 10L12 6" fill="transparent" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </IconSvg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconSvg icon="copy" {...props}>
      <path
        d="M2.75 4.75C2.75 3.64543 3.64543 2.75 4.75 2.75H9.25C10.3546 2.75 11.25 3.64543 11.25 4.75V5.25H12.25V4.75C12.25 3.09315 10.9069 1.75 9.25 1.75H4.75C3.09315 1.75 1.75 3.09315 1.75 4.75V9.25C1.75 10.9069 3.09315 12.25 4.75 12.25H5.25V11.25H4.75C3.64543 11.25 2.75 10.3546 2.75 9.25V4.75Z"
        fill="currentColor"
      />
      <path
        d="M6.75 6.75C6.75 5.64543 7.64543 4.75 8.75 4.75H11.25C12.3546 4.75 13.25 5.64543 13.25 6.75V11.25C13.25 12.3546 12.3546 13.25 11.25 13.25H8.75C7.64543 13.25 6.75 12.3546 6.75 11.25V6.75Z"
        fill="transparent"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <IconSvg icon="sparkles" {...props}>
      <path
        d="M7.4 1.25L8.35 4.4C8.46 4.75 8.75 5.04 9.1 5.15L12.25 6.1L9.1 7.05C8.75 7.16 8.46 7.45 8.35 7.8L7.4 10.95L6.45 7.8C6.34 7.45 6.05 7.16 5.7 7.05L2.55 6.1L5.7 5.15C6.05 5.04 6.34 4.75 6.45 4.4L7.4 1.25Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M12 9.5L12.45 11.05L14 11.5L12.45 11.95L12 13.5L11.55 11.95L10 11.5L11.55 11.05L12 9.5Z"
        fill="currentColor"
      />
    </IconSvg>
  );
}

export function ThumbUpIcon(props: IconProps) {
  return (
    <IconSvg icon="thumb-up" {...props}>
      <path
        d="M6.5 6.5V3.75C6.5 2.7835 7.2835 2 8.25 2C8.94036 2 9.5 2.55964 9.5 3.25V5.5H12.25C13.2165 5.5 14 6.2835 14 7.25C14 7.4212 13.9707 7.59111 13.9134 7.75243L12.6634 11.2524C12.4242 11.924 11.7882 12.375 11.0753 12.375H7.25C6.83579 12.375 6.5 12.0392 6.5 11.625V6.5ZM5 6.75H2.75C2.33579 6.75 2 7.08579 2 7.5V11.75C2 12.1642 2.33579 12.5 2.75 12.5H5V6.75Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}

export function ThumbDownIcon(props: IconProps) {
  return (
    <IconSvg icon="thumb-down" {...props}>
      <path
        d="M9.5 9.5V12.25C9.5 13.2165 8.7165 14 7.75 14C7.05964 14 6.5 13.4404 6.5 12.75V10.5H3.75C2.7835 10.5 2 9.7165 2 8.75C2 8.5788 2.02929 8.40889 2.08661 8.24757L3.33661 4.74757C3.57581 4.076 4.21179 3.625 4.92474 3.625H8.75C9.16421 3.625 9.5 3.96079 9.5 4.375V9.5ZM11 9.25H13.25C13.6642 9.25 14 8.91421 14 8.5V4.25C14 3.83579 13.6642 3.5 13.25 3.5H11V9.25Z"
        fill="transparent"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </IconSvg>
  );
}
