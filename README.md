# Build A Space

[![Build Status](https://travis-ci.org/mntnr/build-a-space.svg?branch=master)](https://travis-ci.org/mntnr/build-a-space) [![Greenkeeper badge](https://badges.greenkeeper.io/mntnr/build-a-space.svg)](https://greenkeeper.io/)

> Automatically add community documentation to your repository

## Background

I often clean up repositories, and have ideas for what I want to add to them. However, just as often, I manually add files to repositories. @gr2m got me thinking - wouldn't it be better if I could automatically add files to a repository, using a GitHub bot?

This GitHub bot does _just that_. It adds a Contributing guide, a Code of Conduct, a README if you don't have one stubbed out, a License, and more to a repository. It lints your `package.json`. It tells you if you don't have an email specified in your CoC. It does a lot of stuff.

The point is to make building a space for community to grow _easier_. This stuff isn't rocket science, but doing it manually day after day is the hard part. Let's make it easier to build a space.

## Install

This hasn't been set up for more than cloning, yet. Clone.

You'll need a [GitHub token](https://github.com/settings/tokens). Put it in the `env.js` file, or in a `$BUILD_A_SPACE` token in your environment.

## Usage

```
Usage
  $ build-a-space <input> [opts]

Options
  -f, --fork  Create and use a fork instead of pushing to a branch
  -t, --test  Don't open issues or create pull requests
  -c, --config  The path to a configuration file
  --email     The email for the Code of Conduct

Examples
  $ build-a-space mntnr/build-a-space
```

Substitute another repo as needed. It drives itself from there.

### Configuration

You can specify a configuration file to stop having to type lots and lots of flags for multiple repositories. This will overwrite any flags you send in.


## Maintainers

[Me](https://burntfen.com).

And [you](https://github.com/mntnr/build-a-space/issues/new?title=I%20want%20to%20be%20a%20maintainer!)?

## Contribute

I would love for this to be a community effort. For now, I am hacking away at it because I want to be able to use it quickly get various documents into place as needed for different organizations I work with. However, if would be great if others would start using it, as well.

Check out the [Contributing guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) for more.

## License

[MIT](LICENSE) © 2017 Richard Littauer
