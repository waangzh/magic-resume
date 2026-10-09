import type { Project } from "@/types/resume";
import LinkedTitle from "./LinkedTitle";

const ProjectName = ({ project }: { project: Project }) => {
  return (
    <LinkedTitle link={project.link} enabled={project.linkOnTitle}>
      {project.name}
    </LinkedTitle>
  );
};

export default ProjectName;
