# General Aviation Checklists

This repository is a template for creating and sharing electronic (and paper)
general aviation checklists and provides automation for compiling it into
several popular EFIS/EFB compliant formats.

## Using

<a href="https://github.com/alexnj/aviation-checklists/releases/latest">
<img align="right" width="500" height="380" alt="image" src="https://github.com/user-attachments/assets/1a340be4-5c9e-4768-92cc-daa18aacfa57" />
</a>

> [!IMPORTANT]
> Read the Disclaimer section below carefully before proceeding.

The recommended usage pattern is to click `Use this template` > `Create a new repository` at the top right of this page, that will create your own checklist repository based on this template. Modify the checklist/ folder contents to add your own JSON checklist definitions or modify one of the provided one to suit your own needs. The GitHub actions integrated into this template will produce EFIS compatible checklists as artifacts of automated builds and releases for your own copy of the repository.

All the checklists are in the `checklists/` directory in readable plain text (JSON) form.
GitHub Actions integrated into this template repository builds each commit into a few EFIS compatible formats using [efis-editor](https://github.com/rdamazio/efis-editor) project, as well as a kneeboard friendly foldable PDF rendering (see screenshot on the right).

Compiled EFIS artifacts can be found on the [Releases](https://github.com/alexnj/aviation-checklists/releases/latest) page.

For modifying or authoring new checklists, I highly recommend [EFIS editor](https://rdamazio.github.io/efis-editor/). It can load the JSON checklists and you can export them into any of the supported formats, or as JSON again to commit back to the repo.

## Disclaimer

> [!IMPORTANT]
> This is not your usual disclaimer - read it carefully.

> [!CAUTION]
> :skull_and_crossbones: Failure to follow proper procedures can result in
> serious injury or death. :skull_and_crossbones:

Use of files provided here with your avionics or EFB is at your own risk,
and comes with no guarantee of any kind that the output will be correct or
safe to use. Approach using these files with the same care that you would any
flight testing activity. It is recommended to thoroughly testing them before use
during actual operations (including checking them with the manufacturer's
recommended apps where available, thoroughly testing on the ground before
flight, having paper copies of your checklists, and any other precautions
you would take when using an avionics configuration that's **_not supported_**
or documented by your avionics manufacturer).

There is no gurantee that the checklists here are complete or accurate to
the procedures you should follow or are within the operation limitations of
the aircraft it is written for. It is your responsibility to ensure that
you are operating the aircraft according to the procedure and limitations
as described in the operating handbook for it.

This project is an independent effort and is not endorsed or supported by
any company.

## Background

During my training I realized that students and seasoned pilots alike,
despite using EFBs and avionics stacks capable of running checklists,
seldom do checklists in them.

I found electronic checklists superior for the reason that they keep track of
where I am in the list, and depending on placement of EFB in the cockpit,
it reduces number of times I have to look down and away from where my eyes
should be. I still carry a paper checklist for redundancy, but I've switched
over to electronic checklists for primary use.

This project is mainly intended to be a template for you to maintain your
checklists, in an editable and shareable form. Storing checklists in plain text
and in open source form should foster wider usage of electronic checklists
and the use of checklists overall with less missed steps. That should in turn
improve safety. Or, that's the goal and intention of this project.

## License

This project is available as Open Source Software, under the Apache 2.0 license.
See [LICENSE](./LICENSE) for details about copyright and redistribution.

## Contributing

If you find a way to improve these checklists, or the code that processes them,
I would be happy to accept those as PR contributions. Just file an issue or make a PR!
