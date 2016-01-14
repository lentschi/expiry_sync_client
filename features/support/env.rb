require 'calabash-android/cucumber'

RESET_BETWEEN_SCENARIOS = '1'

class Hash
  def deep_dup
    Marshal.load( Marshal.dump(self) )
  end
end