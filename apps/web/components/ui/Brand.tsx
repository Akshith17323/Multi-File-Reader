import Link from "next/link";
import { Library } from "lucide-react";

export default function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="inline-flex shrink-0 items-center gap-2.5 rounded-xl"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-purple-600 text-white"><Library size={19} /></span><span className="text-base font-extrabold tracking-tight text-foreground">MultiReader</span></Link>;
}
