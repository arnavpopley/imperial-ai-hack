import { useStaffData } from '../StaffData.tsx';

/** Looks a module up by id for an escalation title (issue 107), as its code and title. */
export function useModuleLookup() {
  const { moduleTitle, moduleCode } = useStaffData();
  return {
    moduleByIdForTitle: (id: string) => {
      const code = moduleCode(id);
      return code ? { code, title: moduleTitle(id) } : undefined;
    },
  };
}
