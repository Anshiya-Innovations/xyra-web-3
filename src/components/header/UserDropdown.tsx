import { clearSession, getSession } from "@/lib/session";
import { LogOut01, User01 } from "@untitledui/icons";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

const itemClass =
  "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const session = getSession();

  const name = session?.name ?? "";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const closeDropdown = () => setIsOpen(false);

  const onSignOut = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="me-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
          {initials}
        </span>

        <span className="me-1 block text-theme-sm font-medium">{name.split(" ")[0]}</span>
        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute inset-e-0 mt-4.25 flex w-65 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block text-theme-sm font-medium text-gray-700 dark:text-gray-400">
            {name}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {session?.email}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" to="/profile" className={itemClass}>
              <User01 className="size-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" />
              Profile
            </DropdownItem>
          </li>
        </ul>
        <button type="button" onClick={onSignOut} className={`mt-3 ${itemClass}`}>
          <LogOut01 className="size-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
